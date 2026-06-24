// input.js — 统一输入适配（键盘 / 滑动手势 / 虚拟方向键）
// 暴露一个 InputController，调用方提供方向回调

const KEY_MAP = {
    ArrowUp: 'up',    KeyW: 'up',
    ArrowDown: 'down',  KeyS: 'down',
    ArrowLeft: 'left',  KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
};

export function createInputController({ onDirection, onPause, onAnyKey }) {
    let active = false;
    let swipeStart = null;
    const SWIPE_THRESHOLD = 24; // 像素

    function fire(dir) {
        if (onDirection) onDirection(dir);
    }

    function onKeyDown(e) {
        if (!active) return;
        if (e.code === 'Space' || e.code === 'Escape' || e.code === 'KeyP') {
            if (onPause) { e.preventDefault(); onPause(); }
            return;
        }
        const dir = KEY_MAP[e.code];
        if (dir) {
            e.preventDefault();
            fire(dir);
            if (onAnyKey) onAnyKey();
        }
    }

    function onTouchStart(e) {
        if (!active) return;
        // 只在画布区域内识别滑动
        const t = e.changedTouches[0];
        if (!t) return;
        swipeStart = { x: t.clientX, y: t.clientY };
    }

    function onTouchEnd(e) {
        if (!active || !swipeStart) return;
        const t = e.changedTouches[0];
        if (!t) { swipeStart = null; return; }
        const dx = t.clientX - swipeStart.x;
        const dy = t.clientY - swipeStart.y;
        swipeStart = null;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (Math.max(absX, absY) < SWIPE_THRESHOLD) return;
        if (absX > absY) {
            fire(dx > 0 ? 'right' : 'left');
        } else {
            fire(dy > 0 ? 'down' : 'up');
        }
    }

    function onDpadClick(e) {
        const target = e.target.closest('[data-dir]');
        if (!target) return;
        const dir = target.dataset.dir;
        if (dir) {
            e.preventDefault();
            fire(dir);
            if (onAnyKey) onAnyKey();
        }
    }

    function onDpadTouchStart(e) {
        const target = e.target.closest('[data-dir]');
        if (!target) return;
        e.preventDefault();
        const dir = target.dataset.dir;
        if (dir) {
            fire(dir);
            if (onAnyKey) onAnyKey();
        }
    }

    function bind() {
        window.addEventListener('keydown', onKeyDown, { passive: false });
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.addEventListener('touchstart', onTouchStart, { passive: true });
            canvas.addEventListener('touchend', onTouchEnd, { passive: true });
        }
        const dpad = document.getElementById('dpad');
        if (dpad) {
            dpad.addEventListener('click', onDpadClick);
            dpad.addEventListener('touchstart', onDpadTouchStart, { passive: false });
        }
    }

    function unbind() {
        window.removeEventListener('keydown', onKeyDown);
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchend', onTouchEnd);
        }
        const dpad = document.getElementById('dpad');
        if (dpad) {
            dpad.removeEventListener('click', onDpadClick);
            dpad.removeEventListener('touchstart', onDpadTouchStart);
        }
    }

    function setActive(v) {
        active = !!v;
        if (v) bind(); else unbind();
    }

    return { setActive };
}

/**
 * 检测设备能力，决定是否默认显示 D-Pad
 */
export function detectCapabilities() {
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 768;
    return {
        hasTouch,
        coarsePointer,
        isSmall,
        preferDPad: hasTouch || coarsePointer || isSmall,
    };
}
