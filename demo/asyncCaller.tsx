import * as React from "react";
import { asyncCaller } from "react-rxdi";
import { Subject } from "rxjs";
import { useObservable } from "rxjs-hooks";
import { filter } from "rxjs/operators";
import retryStrategy from "./retryStrategy";

let timeoutNum = 0;

const AsyncCallerDemo: React.FC<{}> = () => {
  const [{ query$, result$ }] = React.useState(() => {
    const query$ = new Subject<string>();
    const calleeFn = (query: string): Promise<string> => {
      console.log(`actual sending request! query: ${query}`);
      return new Promise((res, rej) => {
        switch (query) {
          case "timeout":
            if (timeoutNum++ < 2) {
              setTimeout(() => {
                res("resolve after timeout");
              }, 2000);
            } else {
              // 重试第三次，没有超时
              setTimeout(() => {
                res("resolve before timeout");
              }, 1000);
            }
            break;
          case "err":
            setTimeout(() => {
              rej("test err!");
              return;
            }, 1000);
            break;
          default:
            setTimeout(() => {
              res(`response for ${query}`);
            }, 1000);
            break;
        }
      });
    };
    const result$ = asyncCaller({
      query$: query$.pipe(filter(q => !!q)),
      calleeFn,
      ...retryStrategy
    });
    return { query$, result$ };
  });

  const query = useObservable(() => query$, "");
  const result = useObservable(() => result$);

  const resultText = (() => {
    if (!query || !result) return "no query yet";
    switch (result.type) {
      case "loading":
        return "loading";
      case "success":
        return `success: ${result.response}`;
      case "error":
        return `error: ${String(result.error)}`;
      default:
        throw new Error(`unexpected result: ${result}`);
    }
  })();

  return (
    <div>
      <div>
        query:
        <input
          type="text"
          value={query}
          onChange={v => {
            query$.next(v.target.value);
          }}
        />
      </div>
      <p>{resultText}</p>
    </div>
  );
};

export default AsyncCallerDemo;
