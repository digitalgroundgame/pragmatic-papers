/**
 * Browser errors Sentry drops before sending. Each is caused by code we don't ship, and
 * `thirdPartyFramesIntegration` can't tag it: most carry no stack frame to classify, and
 * the rest throw inside our own chunks. Sentry tests each pattern against the event's message
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
  // Next's client bootstrap replaces `push` on its own arrays (`self.__next_f.push = …` in
  // next/dist/client/app-index.js). That throws only when an extension has frozen
  // Array.prototype (SES-style lockdown), which makes every array's `push` read-only. The
  // frames are Next's runtime, in our chunks, so the tag can't catch it. We never assign
  // `push` ourselves.
  /^(?:TypeError: )?Cannot assign to read only property 'push' of object '\[object Array\]'$/,
  // A promise rejected with the bare `error` Event of a <script>, <img> or <link> that
  // failed to load. Our own loaders reject with Errors (next/script catches its own, and
  // MathJax's goes to MathJaxProvider's onError), so these come from third-party and
  // injected scripts, and an Event carries no URL or stack to act on.
  /^(?:Event: )?Event `Event` \(type=error\) captured as (?:promise rejection|exception)$/,
]
