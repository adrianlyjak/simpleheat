'use strict';


if (typeof module !== 'undefined') module.exports = simpleheat;

function simpleheat(canvas) {
    if (!(this instanceof simpleheat)) return new simpleheat(canvas);

    this._canvas = canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;

    this._ctx = canvas.getContext('2d');
    this._width = canvas.width;
    this._height = canvas.height;
    this._sorted = false;
    this._options = this.defaultOptions
    this._data = [];
}

simpleheat.prototype = {

    defaultGradient: {
        '0.0': 'rgba(204, 0, 0, 1)',
        '0.25': 'rgba(255, 178, 0, 0.75)',
        '0.5': 'rgba(0, 243, 255, 0.25)',
        '0.75': 'rgba(180, 255, 0, 0.75)',
        '1.0': 'rgba(0, 214, 96, 1)'
    },

    data: function (data) {
        this._data = data;
        this._sorted = false;
        return this;
    },


    add: function (point) {
        this._data.push(point);
        this._sorted = false;
        return this;
    },

    clear: function () {
        this._data = [];
        return this;
    },

    defaultOptions: {
        blendMode: 'overlay',
        max: 1,
        radius: 25,
        blur: 15,
        gradient: {
            '0.0': 'rgba(204, 0, 0, 1)',
            '0.25': 'rgba(255, 178, 0, 0.75)',
            '0.5': 'rgba(0, 243, 255, 0.25)',
            '0.75': 'rgba(180, 255, 0, 0.75)',
            '1.0': 'rgba(0, 214, 96, 1)'
        },
        colorize: true,
        grayscale: {
            negative: '#000000',
            neutral: '#808080',
            positive: '#FFFFFF'   
        }
    },

    setOptions: function(options) {
        this._options = Object.assign({}, this._options, options);
        delete this._circles;
        delete this._grad;
        return this;
    },

    getOptions: function() {
        return Object.assign({}, this._options);
    },

    initializeCircleBrushes: function () {

        // artifacts can emerge if full black is used (white light overlay does nothing to full black)
        var colors = this._options.grayscale

        this._circles = {}

        
        var r2 = this._r = this._options.radius + this._options.blur;

        for (var colorName in colors) {
            var color = colors[colorName];
            var canvas = this._circles[colorName] = this._createCanvas();
            var ctx = canvas.getContext('2d');

            canvas.width = canvas.height = r2 * 2;

            ctx.shadowOffsetX = ctx.shadowOffsetY = r2 * 2;
            ctx.fillStyle = color
            ctx.shadowColor = color;
            ctx.shadowBlur = this._options.blur;
            

            ctx.beginPath();
            ctx.arc(-r2, -r2, this._options.radius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();

        }
        
    },

    resize: function () {
        this._width = this._canvas.width;
        this._height = this._canvas.height;
    },

    gradient: function (grad) {
        // create a 256x1 gradient that we'll use to turn a grayscale heatmap into a colored one
        var canvas = this._createCanvas(),
            ctx = canvas.getContext('2d'),
            gradient = ctx.createLinearGradient(0, 0, 0, 256);

        canvas.width = 1;
        canvas.height = 256;

        for (var i in grad) {
            gradient.addColorStop(+i, grad[i]);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 256);

        this._grad = ctx.getImageData(0, 0, 1, 256).data;

        return this;
    },

    draw: function (minOpacity) {
        if (!this._circles) this.initializeCircleBrushes(this.defaultRadius);
        if (!this._grad) this.gradient(this.defaultGradient);
        if (!this._sorted) {
            // sort so that positive is painted over neutra is painted over negative. Unfortunately there does not seem to be 
            // a globalCompositeOperation that treats source layers equally to the layer on the canvas. 
            // Layer color painted last will be stronger
            this._data.sort((a, b) => a[3] - b[3]);
            this._sorted = true;
        }

        var ctx = this._ctx;
        ctx.globalCompositeOperation = this._options.blendMode;

        ctx.clearRect(0, 0, this._width, this._height);
        
        // draw a grayscale heatmap by putting a blurred circle at each data point
        
        var neg = this._circles.negative
        var zero = this._circles.neutral
        var pos = this._circles.positive
        for (var i = 0, len = this._data.length, p; i < len; i++) {
            p = this._data[i];
            ctx.globalAlpha = Math.max(p[2] / this._options.max, minOpacity === undefined ? 0.05 : minOpacity);
            var circle = p[3] > 0 ? pos : p[3] < 0 ? neg : zero
            ctx.drawImage(circle, p[0] - this._r, p[1] - this._r);
        }

        // colorize the heatmap, using opacity value of each pixel to get the right color from our gradient
        var colored = ctx.getImageData(0, 0, this._width, this._height);
        this._colorize(colored.data, this._grad);
        ctx.putImageData(colored, 0, 0);

        return this;
        
    },

    _colorize: function (pixels, gradient) {
        if (this._options.colorize) {
            for (var i = 0, len = pixels.length, j; i < len; i += 4) {
                var alpha = pixels[i + 3];

                if (alpha) {
                    j = pixels[i] * 4; // get gradient color from red value, (e.g. grayscale value)
                    pixels[i] = gradient[j];
                    pixels[i + 1] = gradient[j + 1];
                    pixels[i + 2] = gradient[j + 2];
                    // pixels[i + 3] = gradient[j + 3]; 
                    pixels[i + 3] = Math.floor((gradient[j + 3] / 256) * (alpha / 256) * 256);
                }
            }
        }
    },

    _createCanvas: function () {
        if (typeof document !== 'undefined') {
            return document.createElement('canvas');
        } else {
            // create a new canvas instance in node.js
            // the canvas class needs to have a default constructor without any parameter
            return new this._canvas.constructor();
        }
    }
};
