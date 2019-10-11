// developed at https://codesandbox.io/s/rxjs-async-caller-sf91n

import { Observable, defer, using, Subject } from "rxjs";
import { switchMap, startWith, tap, publish, refCount } from "rxjs/operators";
import asyncCaller, { GetResultType } from "./asyncCaller";

/**
 * 异步调用管理（带缓存）。
 * 相比直接调用异步过程，
 * 通过asyncCallerWithCache来调用异步过程能获得以下好处：
 * 1. 能获得pending、error、success状态
 * 2. query$更新时，自动调用异步过程，并通过结果返回最新状态
 * 3. query具有与之前相同的cacheKey时，使用缓存结果
 * 4. 通过invalidateCache$可以控制缓存失效，从而重新调用异步过程
 */
export default function asyncCallerWithCache<QueryType, ResponseType>(opts: {
  query$: Observable<QueryType>; // query更新时，先去查看是否有对应缓存
  calleeFn: (query: QueryType) => Promise<ResponseType>;
  getCacheKey: (query: QueryType) => string;
  invalidateCache$: Observable<QueryType>; // 使缓存失效，发起真实请求
}) {
  type ResultType = GetResultType<QueryType, ResponseType>;

  const { query$, invalidateCache$, calleeFn, getCacheKey } = opts;
  // cacheKey (根据query计算得到) => 被缓存的结果流 + 用来触发新请求的Subject
  const cache = new Map<
    string,
    {
      trigger$: Subject<QueryType>;
      result$: Observable<Observable<ResultType>>;
    }
  >();

  const fetchResultWithCache: (query: QueryType) => Observable<ResultType> = (
    query: QueryType
  ) =>
    defer(() => {
      const cacheKey = getCacheKey(query);
      if (!cache.has(cacheKey)) {
        // 尚未查询过这个query，需要为它新建一个缓存流
        const trigger$ = new Subject<QueryType>();
        const result$ = asyncCaller({
          // 开始时先请求一次query
          query$: trigger$.pipe(startWith(query)),
          calleeFn
        });

        cache.set(cacheKey, { trigger$, result$ });
      }
      // 已有缓存流，发出最新的请求的状态
      const { result$ } = cache.get(cacheKey)!;
      return result$.pipe(switchMap(fetch$ => fetch$));
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
    const { trigger$ } = cache.get(cacheKey)!;
    trigger$.next(query);
  };
  const refreshCache$ = invalidateCache$.pipe(
    tap(query => {
      // console.log("emitNewQueryCache");
      emitNewFetchStream(query);
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
