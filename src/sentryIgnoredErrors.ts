/**
 * Browser errors Sentry drops before sending. Each comes from code we don't ship, and
 * none carries a stack frame, so `thirdPartyFramesIntegration` has nothing
 * to classify and can't tag it. Sentry tests each pattern against the event's message
 * and its `Type: value`. Keep them narrow: anything they match is never reported.
 */
export const sentryIgnoredErrors: RegExp[] = [
  // Outlook / Defender Safe Links scanners (CefSharp) opening links from our emails
  // reject a promise with this string. No visitor is involved
  // (getsentry/sentry-javascript#3440).
  /^Non-Error promise rejection captured with value: Object Not Found Matching Id:\d+, MethodName:\w+, ParamCount:\d+$/,
  // Crypto-wallet in-app browsers inject a script that writes to window.ethereum before
  // defining it. We never use window.ethereum.
  /window\.ethereum\b/,
  // Firefox for iOS injects its reader-mode script into every page.
  /window\.__firefox__\b/,
]
