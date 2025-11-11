import { View } from 'rasti';

export const KEY_UP = 38;
export const KEY_RIGHT = 39;
export const KEY_DOWN = 40;
export const KEY_LEFT = 37;

// WASD key codes
export const KEY_W = 87;
export const KEY_A = 65;
export const KEY_S = 83;
export const KEY_D = 68;

// Map physical keys → logical arrow key actions
const KEY_MAP = {
    [KEY_UP]: KEY_UP,
    [KEY_W]: KEY_UP,

    [KEY_RIGHT]: KEY_RIGHT,
    [KEY_D]: KEY_RIGHT,

    [KEY_DOWN]: KEY_DOWN,
    [KEY_S]: KEY_DOWN,

    [KEY_LEFT]: KEY_LEFT,
    [KEY_A]: KEY_LEFT
};

export const EVENT_KEY_UP = 'keyup';
export const EVENT_KEY_DOWN = 'keydown';

class Keyboard extends View {
    constructor(options) {
        super({
            el: document && document.body,
            ...options
        });

        this.keys = {};
    }

    translateCode(code) {
        return KEY_MAP[code] ?? code;
    }

    onKeyUp(event) {
        const key = this.translateCode(event.keyCode);
        this.keys[key] = false;
        this.emit(EVENT_KEY_UP, { ...event, keyCode: key });
    }

    onKeyDown(event) {
        const key = this.translateCode(event.keyCode);
        this.keys[key] = true;
        this.emit(EVENT_KEY_DOWN, { ...event, keyCode: key });
    }

    clear() {
        this.keys = {};
    }
}

Keyboard.prototype.events = {
    keyup: 'onKeyUp',
    keydown: 'onKeyDown'
};

export default Keyboard;
