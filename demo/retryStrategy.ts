import { IAsyncCallerOptions } from "react-rxdi";

const retryStrategy: Pick<
  IAsyncCallerOptions<string, string>,
  "timeout" | "decideRetry"
> = {
  timeout: 1500,
  decideRetry: (
    error: any,
    context: { timeoutCount: number; otherErrorCount: number }
  ) => {
    if (context.timeoutCount === undefined) context.timeoutCount = 0;
    if (context.otherErrorCount === undefined) context.otherErrorCount = 0;

    if (error instanceof Error && error.name === "TimeoutError") {
      if (context.timeoutCount++ < 2)
        // 超时重试2次
        return {
          type: "retry",
          delay: 1000
        };
      return {
        type: "giveUp",
        reason: error
      };
    }

    // 其他错误重试1次
    if (context.otherErrorCount++ < 1)
      return {
        type: "retry",
        delay: 0
      };
    return {
      type: "giveUp",
      reason: error
    };
  }
};

export default retryStrategy;
