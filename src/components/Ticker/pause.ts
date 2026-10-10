/** Set in localStorage while a reader has the ticker paused, so it stays paused on the next page. */
export const TICKER_PAUSED_KEY = "pp:ticker-paused"

/**
 * Runs inline right after the pause switch, as the page is parsed and before it paints, so a
 * reader who paused the ticker never sees it move or stick. It ticks the switch when they paused
 * it last time, and records each change. A reader who never touches the switch pays only for this
 * line: no JavaScript chunk. Private mode and blocked site data can make localStorage throw,
 * which reads as not paused.
 */
export const TICKER_PAUSE_SCRIPT = `try{var s=document.currentScript.previousElementSibling;s.checked=localStorage.getItem("${TICKER_PAUSED_KEY}")==="1";s.addEventListener("change",function(){try{s.checked?localStorage.setItem("${TICKER_PAUSED_KEY}","1"):localStorage.removeItem("${TICKER_PAUSED_KEY}")}catch(e){}})}catch(e){}`
