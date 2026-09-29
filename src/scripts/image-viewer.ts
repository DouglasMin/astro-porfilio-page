/**
 * Click-to-zoom viewer for post images. Opens the image in the page's
 * `#image-viewer` dialog fitted to the screen; clicking the image (or the
 * "원본 크기" button) switches to actual size, which can be panned by dragging
 * with a mouse or by scrolling on touch and trackpads.
 */

const DRAG_THRESHOLD_PX = 4;
const LABEL_ACTUAL = '원본 크기';
const LABEL_FIT = '화면에 맞추기';

interface DragState {
  x: number;
  y: number;
  left: number;
  top: number;
  moved: boolean;
}

export function setupImageViewer(prose: Element, signal: AbortSignal): void {
  const dialog = document.getElementById('image-viewer') as HTMLDialogElement | null;
  const stage = dialog?.querySelector<HTMLElement>('.viewer-stage');
  const image = dialog?.querySelector<HTMLImageElement>('.viewer-image');
  const zoomButton = dialog?.querySelector<HTMLButtonElement>('.viewer-zoom');
  const closeButton = dialog?.querySelector<HTMLButtonElement>('.viewer-close');
  if (!dialog || !stage || !image || !zoomButton || !closeButton) return;

  let drag: DragState | undefined;
  let suppressClick = false;

  const isActual = () => dialog.classList.contains('is-actual');

  /** Only worth zooming when the file has more pixels than the fitted view shows. */
  const updateZoomable = () => {
    if (isActual()) return;
    const zoomable = image.naturalWidth > image.clientWidth + 1 || image.naturalHeight > image.clientHeight + 1;
    dialog.classList.toggle('is-zoomable', zoomable);
    zoomButton.hidden = !zoomable;
  };

  /** Switch modes while keeping the point under (x, y) fixed on screen. */
  const setActual = (actual: boolean, x: number, y: number) => {
    const before = image.getBoundingClientRect();
    const ratioX = (x - before.left) / before.width;
    const ratioY = (y - before.top) / before.height;

    dialog.classList.toggle('is-actual', actual);
    zoomButton.textContent = actual ? LABEL_FIT : LABEL_ACTUAL;
    zoomButton.setAttribute('aria-pressed', String(actual));
    if (!actual) return;

    const after = image.getBoundingClientRect();
    stage.scrollLeft += after.left + ratioX * after.width - x;
    stage.scrollTop += after.top + ratioY * after.height - y;
  };

  const toggleAtCenter = () => {
    const rect = stage.getBoundingClientRect();
    setActual(!isActual(), rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const open = (source: HTMLImageElement) => {
    dialog.classList.remove('is-actual', 'is-zoomable');
    zoomButton.textContent = LABEL_ACTUAL;
    zoomButton.setAttribute('aria-pressed', 'false');
    zoomButton.hidden = true;
    image.alt = source.alt;
    image.src = source.currentSrc || source.src;
    dialog.showModal();
    if (image.complete) updateZoomable();
  };

  prose.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    if (img.closest('a, button')) return;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'image-zoom-trigger';
    trigger.setAttribute('aria-label', img.alt ? `${img.alt} 크게 보기` : '이미지 크게 보기');
    img.replaceWith(trigger);
    trigger.append(img);
    trigger.addEventListener('click', () => open(img), { signal });
  });

  image.addEventListener('load', updateZoomable, { signal });
  window.addEventListener('resize', () => dialog.open && updateZoomable(), { signal });
  zoomButton.addEventListener('click', toggleAtCenter, { signal });
  closeButton.addEventListener('click', () => dialog.close(), { signal });

  // Clicking the image zooms; clicking the dark area around it closes.
  stage.addEventListener(
    'click',
    (event) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (event.target !== image) {
        dialog.close();
      } else if (dialog.classList.contains('is-zoomable')) {
        setActual(!isActual(), event.clientX, event.clientY);
      }
    },
    { signal },
  );

  // Mouse drag pans in actual-size mode; touch keeps native scrolling.
  stage.addEventListener(
    'pointerdown',
    (event) => {
      suppressClick = false;
      if (event.pointerType !== 'mouse' || event.button !== 0 || !isActual()) return;
      drag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop, moved: false };
    },
    { signal },
  );

  stage.addEventListener(
    'pointermove',
    (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        // Capture only once it is a real drag: while captured, the follow-up
        // click targets the stage, which would otherwise read as "close".
        drag.moved = true;
        stage.setPointerCapture(event.pointerId);
        dialog.classList.add('is-dragging');
      }
      stage.scrollLeft = drag.left - dx;
      stage.scrollTop = drag.top - dy;
    },
    { signal },
  );

  const endDrag = () => {
    if (!drag) return;
    suppressClick = drag.moved;
    drag = undefined;
    dialog.classList.remove('is-dragging');
  };
  stage.addEventListener('pointerup', endDrag, { signal });
  stage.addEventListener('pointercancel', endDrag, { signal });
}
