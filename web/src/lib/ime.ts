/**
 * True while a keyboard is still composing a word (phone suggestions, accented or non-Latin input).
 * An Enter pressed then belongs to the keyboard; Safari sends keyCode 229 for the Enter that ends a composition.
 */
export function isComposingKey(event: { nativeEvent: { isComposing: boolean }; keyCode: number }): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}
