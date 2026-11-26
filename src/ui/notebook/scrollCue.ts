/**
 * A quiet "there is more below" for a scrolling part of a page: the element
 * gets `has-more` while anything is hidden past its foot (the stylesheet fades
 * that edge and shows a small cue) and `is-scrolled` once it has moved off its
 * top. It follows scrolling, resizing and new content on its own.
 */
export function scrollCue(el: HTMLElement): HTMLElement {
  let frame = 0;
  const check = (): void => {
    frame = 0;
    const more = el.scrollHeight - el.clientHeight - el.scrollTop > 6;
    el.classList.toggle('has-more', more);
    el.classList.toggle('is-scrolled', el.scrollTop > 6);
  };
  const soon = (): void => { if (!frame) frame = requestAnimationFrame(check); };
  el.addEventListener('scroll', soon, { passive: true });
  const sizes = new ResizeObserver(soon);
  sizes.observe(el);
  const watchChildren = (): void => { for (const child of el.children) sizes.observe(child); };
  watchChildren();
  // A row opened in full, or a slip re-rendered, changes what is hidden below.
  new MutationObserver((records) => {
    if (records.every((r) => r.target === el && r.type === 'attributes')) return;
    watchChildren(); soon();
  }).observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open'] });
  soon();
  return el;
}
