/**
 * Browser errors Sentry drops before sending. Each comes from code we don't ship, and
 * none carries a stack frame, so `thirdPartyErrorFilterIntegration` has nothing
 * to classify and can't catch it. Sentry tests each pattern against the event's message
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
  // A promise rejected with the bare `error` Event of a <script>, <img> or <link> that
  // failed to load. Our own loaders reject with Errors (next/script catches its own, and
  // MathJax's goes to MathJaxProvider's onError), so these come from third-party and
  // injected scripts, and an Event carries no URL or stack to act on.
  /^(?:Event: )?Event `Event` \(type=error\) captured as (?:promise rejection|exception)$/,
]
