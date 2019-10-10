// developed at https://codesandbox.io/s/rxjs-async-caller-sf91n

import { Observable, defer, of, BehaviorSubject, using } from "rxjs";
import {
  switchMap,
  map,
  startWith,
  catchError,
  tap,
  publish,
  refCount,
  shareReplay
} from "rxjs/operators";

export type GetResultType<QueryType, ResponseType> =
  | { type: "loading"; query: QueryType }
  | { type: "success"; query: QueryType; response: ResponseType }
  | { type: "error"; query: QueryType; error: any };

/**
 * 异步调用管理。
 * 相比直接调用异步过程，
 * 通过asyncCaller来调用异步过程能获得以下好处：
 * 1. 能获得pending、error、success状态
 * 2. 根据query来缓存结果
 * 3. 重试并更新缓存
 */
export default function asyncCaller<QueryType, ResponseType>(opts: {
  query$: Observable<QueryType>; // query更新时，先去查看是否有对应缓存
  calleeFn: (query: QueryType) => Promise<ResponseType>;
  getCacheKey: (query: QueryType) => string;
  invalidateCache$: Observable<QueryType>; // 使缓存失效，发起真实请求
}) {
  type ResultType = GetResultType<QueryType, ResponseType>;

  const { query$, invalidateCache$, calleeFn, getCacheKey } = opts;
  const cache = new Map<
    string,
    // 缓存流：缓存更新时，通过BehaviorSubject来发射新的请求流
    BehaviorSubject<Observable<ResultType>>
  >();

  // 输入请求参数，返回一个请求流（封装一次请求过程）
  const fetchResult: (query: QueryType) => Observable<ResultType> = (
    query: QueryType
  ) =>
    defer(() => calleeFn(query)).pipe(
      map(response => {
        return {
          type: "success",
          query,
          response
        } as ResultType;
      }),
      // 为每个请求增加loading状态和error状态
      startWith({ type: "loading", query } as ResultType),
      catchError(error => of({ type: "error", query, error } as ResultType)),
      // 缓存最近一个状态
      // 从而反复订阅、取消这个流，不会触发新的请求
      shareReplay({
        bufferSize: 1,
        refCount: false
      })
    );

  const fetchResultWithCache: (query: QueryType) => Observable<ResultType> = (
    query: QueryType
  ) =>
    defer(() => {
      const cacheKey = getCacheKey(query);
      if (!cache.has(cacheKey)) {
        // 尚未查询过这个query，需要为它新建一个缓存流
        const fetch$ = fetchResult(query);
        cache.set(cacheKey, new BehaviorSubject(fetch$));
      }
      // 已有缓存流，发出最新的请求的状态
      const queryCache$ = cache.get(cacheKey)!;
      return queryCache$.pipe(switchMap(fetch$ => fetch$));
    });
  const queryResult$ = query$.pipe(
    switchMap(query => fetchResultWithCache(query))
  );

  // cache更新逻辑 start
  const emitNewFetchStream = (query: QueryType) => {
    const cacheKey = getCacheKey(query);
    if (!cache.has(cacheKey)) {
      // 没有缓存流，无需reset
      return;
    }
    // 有缓存流，向缓存流发送新值
    const queryCache$ = cache.get(cacheKey)!;
    const newFetch$ = fetchResult(query);
    queryCache$.next(newFetch$);
    return;
  };
  const refreshCache$ = invalidateCache$.pipe(
    tap(query => {
      // console.log("emitNewQueryCache");
      return emitNewFetchStream(query);
    }),
    publish(),
    refCount()
  );
  // cache更新逻辑 end

  return using(
    () => refreshCache$.subscribe(),
    () => queryResult$
  ) as Observable<ResultType>;
}
