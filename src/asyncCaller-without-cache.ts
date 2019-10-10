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
}) {
  type ResultType = GetResultType<QueryType, ResponseType>;

  const { query$, calleeFn } = opts;

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

  return query$.pipe(switchMap(fetchResult));
}
