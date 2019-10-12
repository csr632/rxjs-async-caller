// developed at https://codesandbox.io/s/rxjs-async-caller-sf91n

import { Observable, defer, of, identity, throwError, timer } from "rxjs";
import {
  switchMap,
  map,
  startWith,
  catchError,
  shareReplay,
  timeout,
  retryWhen,
  mergeMap
} from "rxjs/operators";

export type GetResultType<QueryType, ResponseType> =
  | { type: "loading"; query: QueryType }
  | { type: "success"; query: QueryType; response: ResponseType }
  | { type: "error"; query: QueryType; error: any };

export type IRetryDecision =
  | { type: "retry"; delay: number }
  | { type: "giveUp"; reason: any };
/**
 * 异步调用管理。
 * 相比直接调用异步过程，通过asyncCaller来调用异步过程能获得以下好处：
 * 1. 帮你维护pending、error、success状态
 * 2. query$更新时，自动调用异步过程，并更新流的状态
 * 3. 超时检测，用户定义超时阈值，超时视为出错
 * 4. 出错重试，用户可自定义是否要重试（不重试则进入error状态）、等待多久重试。
 *  可配合超时检测一起用，在超时以后重试若干次。
 *
 * 你可以将它类比于Redux：
 *  使用者发射新query（query$.next(query)）相当于dispatch(action)；
 *  返回流的状态更新，可以理解为state被effect->action->reducer更新。
 *
 * 使用Redux同样可以实现pending状态管理、出错重试等功能，
 * 但是这种Redux逻辑的可复用很差。如果有10个API需要这种管理，
 * 你很难在复用异步管理逻辑的同时保证typescript类型安全
 * （因为你需要通过字符串来拼接出state的key）。
 */
export default function asyncCaller<QueryType, ResponseType>(opts: {
  query$: Observable<QueryType>;
  calleeFn: (query: QueryType) => Promise<ResponseType>;
  timeout?: number;
  decideRetry?: (error: any, index: number) => IRetryDecision;
}): Observable<GetResultType<QueryType, ResponseType>> {
  type ResultType = GetResultType<QueryType, ResponseType>;

  const { query$, calleeFn, timeout: timeoutParam, decideRetry } = opts;

  // 输入请求参数，返回一个请求流（封装一次请求过程）
  const fetchResult: (query: QueryType) => Observable<ResultType> = (
    query: QueryType
  ) =>
    defer(() => calleeFn(query)).pipe(
      // timeout会造成Error，进而造成retry
      // 当然，calleeFn reject也会造成retry
      typeof timeoutParam === "number" ? timeout(timeoutParam) : identity,
      retryWhen(error$ =>
        error$.pipe(
          mergeMap((error, index) => {
            if (typeof decideRetry !== "function") return throwError(error);
            const decision = decideRetry(error, index);
            if (decision.type === "retry") {
              return timer(decision.delay);
            }
            if (decision.type === "giveUp") {
              return throwError(decision.reason);
            }
            return throwError(error);
          })
        )
      ),
      map(response => {
        return {
          type: "success",
          query,
          response
        } as ResultType;
      }),
      // 为每个请求增加loading状态和error状态
      // 注意，retry的过程中一直是loading状态，retry失败以后才是error状态
      startWith({ type: "loading", query } as ResultType),
      catchError(error => of({ type: "error", query, error } as ResultType)),
      // 缓存【请求流】的最新状态
      // 多次订阅、取消这个流，不会造成多次发出请求
      shareReplay({
        bufferSize: 1,
        refCount: false
      })
    );

  // query$只会被订阅一次，不管下面这个流被subscribe多少次
  return query$.pipe(
    map(fetchResult),
    // 缓存【最新的请求Observable】,而不是switchMap后的结果。
    // 好处是，query$更新时，并不会立刻订阅【请求Observable】、发起请求，
    // 当有人订阅整个Observable的时候，才会真正订阅【请求Observable】发出请求
    shareReplay({
      bufferSize: 1,
      refCount: false
    }),
    switchMap(fetch$ => fetch$)
  );
}
