// developed at https://codesandbox.io/s/rxjs-async-caller-sf91n

import { Observable, defer, of } from "rxjs";
import {
  switchMap,
  map,
  startWith,
  catchError,
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
 * 2. query$更新时，自动调用异步过程，并通过结果返回最新状态
 */
export default function asyncCaller<QueryType, ResponseType>(opts: {
  query$: Observable<QueryType>; // query更新时，先去查看是否有对应缓存
  calleeFn: (query: QueryType) => Promise<ResponseType>;
}): Observable<Observable<GetResultType<QueryType, ResponseType>>> {
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
      // 让订阅者立刻获得【请求流】的最新状态
      // 多次订阅、取消这个流，不会造成多次发出请求
      shareReplay({
        bufferSize: 1,
        refCount: false
      })
    );

  return query$.pipe(
    map(fetchResult),
    // 让订阅者立刻获得【最新的请求流】
    shareReplay({
      bufferSize: 1,
      refCount: false
    })
  );
}
