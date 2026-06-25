// input.js — 统一输入适配（虚拟遥感 + 键盘 8 向）
// 暴露 InputController 与一个 360° 全方向的方向向量 (dx, dy)

const KEY_VECTORS = {
    ArrowUp:    { x:  0, y: -1 },
    KeyW:       { x:  0, y: -1 },
    ArrowDown:  { x:  0, y:  1 },
    KeyS:       { x:  0, y:  1 },
    ArrowLeft:  { x: -1, y:  0 },
    KeyA:       { x: -1, y:  0 },
    ArrowRight: { x:  1, y:  0 },
    KeyD:       { x:  1, y:  0 },
};

export function createInputController({ onDirection, onPause, onReset }) {
    let active = false;
    // 键盘方向（同时多键支持）
    const pressedKeys = new Set();
    // 遥感方向
    let joystickDx = 0;
    let joystickDy = 0;
    let usingJoystick = false;

    function recompute() {
        // 优先用遥感
        if (usingJoystick && (joystickDx !== 0 || joystickDy !== 0)) {
            fire(joystickDx, joystickDy);
            return;
        }
        // 否则用键盘
        let dx = 0, dy = 0;
        for (const code of pressedKeys) {
            const v = KEY_VECTORS[code];
            if (v) { dx += v.x; dy += v.y; }
        }
        // 归一化
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0) { dx /= d; dy /= d; }
        fire(dx, dy);
    }

    function fire(dx, dy) {
        if (onDirection) onDirection(dx, dy);
    }

    function onKeyDown(e) {
        if (!active) return;
        if (e.code === 'Space' || e.code === 'Escape' || e.code === 'KeyP') {
            if (onPause) { e.preventDefault(); onPause(); }
            return;
        }
        if (e.code === 'KeyR') {
            if (onReset) { e.preventDefault(); onReset(); }
            return;
        }
        if (KEY_VECTORS[e.code]) {
            e.preventDefault();
            pressedKeys.add(e.code);
            usingJoystick = false;
            recompute();
        }
    }

    function onKeyUp(e) {
        if (KEY_VECTORS[e.code]) {
            pressedKeys.delete(e.code);
            recompute();
        }
    }

    function onBlur() {
        pressedKeys.clear();
        joystickDx = 0;
        joystickDy = 0;
        usingJoystick = false;
        fire(0, 0);
    }

    // 虚拟遥感
    function bindJoystick() {
        const joystickEl = document.getElementById('joystick');
        const zone = document.getElementById('joystick-zone');
        const knob = document.getElementById('joystick-knob');
        if (!zone || !knob) return;

        const maxOffset = 38; // 摇杆最大偏移像素
        let center = { x: 0, y: 0 };
        let activePointer = null;

        function setKnob(dx, dy) {
            // dx, dy 为归一化值
            const ox = dx * maxOffset;
            const oy = dy * maxOffset;
            knob.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;
        }

        function start(clientX, clientY) {
            const r = zone.getBoundingClientRect();
            center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            activePointer = true;
            usingJoystick = true;
            pressedKeys.clear();
            if (joystickEl) joystickEl.classList.add('active');
            move(clientX, clientY);
        }

        function move(clientX, clientY) {
            if (!activePointer) return;
            let dx = (clientX - center.x) / maxOffset;
            let dy = (clientY - center.y) / maxOffset;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 1) { dx /= d; dy /= d; }
            joystickDx = dx;
            joystickDy = dy;
            setKnob(dx, dy);
            fire(dx, dy);
        }

        function end() {
            if (!activePointer) return;
            activePointer = false;
            joystickDx = 0;
            joystickDy = 0;
            usingJoystick = false;
            if (joystickEl) joystickEl.classList.remove('active');
            setKnob(0, 0);
            fire(0, 0);
        }

        // Touch
        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            if (t) start(t.clientX, t.clientY);
        }, { passive: false });
        zone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            if (t) move(t.clientX, t.clientY);
        }, { passive: false });
        zone.addEventListener('touchend', (e) => { e.preventDefault(); end(); }, { passive: false });
        zone.addEventListener('touchcancel', (e) => { e.preventDefault(); end(); }, { passive: false });

        // Mouse（桌面调试用）
        zone.addEventListener('mousedown', (e) => {
            e.preventDefault();
            start(e.clientX, e.clientY);
            const onMove = (ev) => move(ev.clientX, ev.clientY);
            const onUp = () => {
                end();
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });
    }

    function bind() {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        bindJoystick();
    }

    function unbind() {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
    }

    function setActive(v) {
        active = !!v;
        if (v) bind(); else unbind();
    }

    return { setActive };
}

/**
 * 检测设备能力，决定是否默认显示虚拟遥感
 */
export function detectCapabilities() {
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 900;
    return {
        hasTouch,
        coarsePointer,
        isSmall,
        preferJoystick: hasTouch || coarsePointer || isSmall,
    };
}
