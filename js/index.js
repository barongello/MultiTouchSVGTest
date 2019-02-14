let whiteboard = null;
let touchesList = {};
let selectedMode = 'draw';
let strokeColor = [255, 0, 0];
let strokeColorAlpha = 1;
let strokeWidth = 4;



const GUID = function* () {
  let message = Math.random().toString() + (new Date()).getTime().toString() + Math.random().toString();
  let hash = sha256(message);

  while (true) {
    yield hash;

    message = hash + Math.random().toString() + (new Date()).getTime().toString() + Math.random().toString() + hash;
    hash = sha256(message);
  }
};

const guid = () => {
  let guid = GUID().next();

  return guid.value;
};

const randomRGBColor = () => [parseInt(Math.random() * 256), parseInt(Math.random() * 256), parseInt(Math.random() * 256)];

const buildStrokeColor = () => {
  let color = (strokeColor !== 'random' ? strokeColor : randomRGBColor());

  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${strokeColorAlpha})`;
}

const buildStrokeWidth = () => (strokeWidth !== 'random' ? strokeWidth : Math.pow(2, parseInt(Math.random() * 4) + 2));

const line = (inPointA, inPointB) => {
  const lengthX = inPointB[0] - inPointA[0];
  const lengthY = inPointB[1] - inPointA[1];

  return {
    length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
    angle: Math.atan2(lengthY, lengthX)
  };
};

const controlPoint = (inCurrent, inPrevious, inNext, inReverse) => {
  const p = inPrevious || inCurrent;
  const n = inNext || inCurrent;

  const smoothing = 0.2;
  const opposite = line(p, n);

  const angle = opposite.angle + (inReverse ? Math.PI : 0)
  const length = opposite.length * smoothing;

  const x = inCurrent[0] + Math.cos(angle) * length;
  const y = inCurrent[1] + Math.sin(angle) * length;

  return [x, y];
};

const pathCommandBezier = (inPoint, inIndex, inArray) => {
  const [cpsX, cpsY] = controlPoint(inArray[inIndex - 1], inArray[inIndex - 2], inPoint);
  const [cpeX, cpeY] = controlPoint(inPoint, inArray[inIndex - 1], inArray[inIndex + 1], true);

  return `C ${cpsX},${cpsY} ${cpeX},${cpeY} ${inPoint[0]},${inPoint[1]}`;
};

const pathCommandLine = inPoint => `L ${inPoint[0]} ${inPoint[1]}`;

const strokeToPath = (inPoints, inPathCommand) => {
  let path = '';

  for(const [i, point] of inPoints.entries()) {
    path += i === 0 ? `M ${point[0]},${point[1]}` : ` ${inPathCommand(point, i, inPoints)}`;
  }

  return path;
};

const inputDownDrawHandler = (event) => {
  let isTouchEvent = (window.TouchEvent !== void 0 && event instanceof TouchEvent === true);
  let isMouseEvent = (window.MouseEvent !== void 0 && event instanceof MouseEvent === true);

  if(isTouchEvent === false && isMouseEvent === false) {
    return;
  }

  let uid = null;

  if(isMouseEvent === true) {
    uid = guid();
  }

  if(isTouchEvent === true) {
    for(let touch of event.changedTouches) {
      let target = null;
      let element = touch.target;

      while(element !== document) {
        if(element.tagName.toLowerCase() === 'svg') {
          target = element;

          break;
        }

        element = element.parentNode;
      }

      if(target !== null) {
        let stroke = null;
        let strokeData = [];
        let strokePath = '';

        let targetBoundingBox = target.getBoundingClientRect();

        let startX = touch.clientX - targetBoundingBox.x;
        let startY = touch.clientY - targetBoundingBox.y;

        let color = buildStrokeColor();
        let size = buildStrokeWidth();

        stroke = SVG(target).path().fill('none').stroke(color).attr('stroke-width', size).attr('stroke-linecap', 'round');

        strokeData.push([startX, startY]);

        strokePath = `M ${startX},${startY}`;

        stroke.plot(strokePath);

        touchesList[touch.identifier] = {
          id: touch.identifier,
          stroke: stroke,
          strokeData: strokeData,
          strokePath: strokePath,
          target: target
        };
      }
    }
  }
  else {
    let target = null;
    let element = event.target;

    while(element !== document) {
      if(element.tagName.toLowerCase() === 'svg') {
        target = element;

        break;
      }

      element = element.parentNode;
    }

    if(target !== null) {
      let stroke = null;
      let strokeData = [];
      let strokePath = '';

      let targetBoundingBox = target.getBoundingClientRect();

      let startX = event.clientX - targetBoundingBox.x;
      let startY = event.clientY - targetBoundingBox.y;

      let color = buildStrokeColor();
      let size = buildStrokeWidth();

      stroke = SVG(target).path().fill('none').stroke(color).attr('stroke-width', size).attr('stroke-linecap', 'round');

      strokeData.push([startX, startY]);

      strokePath = `M ${startX},${startY}`;

      stroke.plot(strokePath);

      touchesList[uid] = {
        id: uid,
        stroke: stroke,
        strokeData: strokeData,
        strokePath: strokePath,
        target: target
      };
    }
  }

  const inputMoveHandler = (event) => {
    let isTouchEvent = (window.TouchEvent !== void 0 && event instanceof TouchEvent === true);
    let isMouseEvent = (window.MouseEvent !== void 0 && event instanceof MouseEvent === true);

    if(isTouchEvent === true) {
      for(let touch of event.changedTouches) {
        let touchSource = (touchesList.hasOwnProperty(touch.identifier) ? touchesList[touch.identifier] : null);

        let moveTarget = null;
        let moveElement = (touchSource !== null ? touchSource.target : touch.target);

        while(moveElement !== document) {
          if(moveElement.tagName.toLowerCase() === 'svg') {
            moveTarget = moveElement;

            break;
          }

          moveElement = moveElement.parentNode;
        }

        if(moveTarget !== null && touchSource !== null) {
          let moveTargetBoundingBox = moveTarget.getBoundingClientRect();

          let moveX = touch.clientX - moveTargetBoundingBox.x;
          let moveY = touch.clientY - moveTargetBoundingBox.y;

          touchSource.strokeData.push([moveX, moveY]);

          touchSource.strokePath += ` ${moveX},${moveY}`;

          touchSource.stroke.plot(touchSource.strokePath);

          let currentElement = document.elementFromPoint(touch.clientX, touch.clientY);
          let currentTarget = null;

          while(currentElement !== null && currentElement !== document && currentElement !== window) {
            if(currentElement.tagName.toLowerCase() === 'svg') {
              currentTarget = currentElement;

              break;
            }

            currentElement = currentElement.parentNode;
          }

          if(currentTarget !== touchSource.target) {
            touchSource.stroke.plot(strokeToPath(touchSource.strokeData, pathCommandBezier));

            if(currentTarget !== null) {
              let currentTargetBoundingBox = currentTarget.getBoundingClientRect();

              moveX += moveTargetBoundingBox.x;
              moveY += moveTargetBoundingBox.y;

              moveX -= currentTargetBoundingBox.x;
              moveY -= currentTargetBoundingBox.y;

              touchSource.strokePath = `M ${moveX},${moveY}`;
              touchSource.strokeData = [[moveX, moveY]];
              touchSource.stroke = SVG(currentTarget).path().fill('none').stroke(touchSource.stroke.attr('stroke')).attr('stroke-width', touchSource.stroke.attr('stroke-width')).attr('stroke-linecap', touchSource.stroke.attr('stroke-linecap'));
              touchSource.target = currentTarget;

              touchSource.stroke.plot(touchSource.strokePath);
            }
          }
        }
      }
    }
    else {
      let touchSource = (touchesList.hasOwnProperty(uid) ? touchesList[uid] : null);

      let moveTarget = null;
      let moveElement = (touchSource !== null ? touchSource.target : event.target);

      while(moveElement !== document) {
        if(moveElement.tagName.toLowerCase() === 'svg') {
          moveTarget = moveElement;

          break;
        }

        moveElement = moveElement.parentNode;
      }

      if(moveTarget !== null && touchSource !== null) {
        let moveTargetBoundingBox = moveTarget.getBoundingClientRect();

        let moveX = event.clientX - moveTargetBoundingBox.x;
        let moveY = event.clientY - moveTargetBoundingBox.y;

        touchSource.strokeData.push([moveX, moveY]);

        touchSource.strokePath += ` ${moveX},${moveY}`;

        touchSource.stroke.plot(touchSource.strokePath);

        let currentElement = document.elementFromPoint(event.clientX, event.clientY);
        let currentTarget = null;

        while(currentElement !== null && currentElement !== document && currentElement !== window) {
          if(currentElement.tagName.toLowerCase() === 'svg') {
            currentTarget = currentElement;

            break;
          }

          currentElement = currentElement.parentNode;
        }

        if(currentTarget !== touchSource.target) {
          touchSource.stroke.plot(strokeToPath(touchSource.strokeData, pathCommandBezier));

          if(currentTarget !== null) {
            let currentTargetBoundingBox = currentTarget.getBoundingClientRect();

            moveX += moveTargetBoundingBox.x;
            moveY += moveTargetBoundingBox.y;

            moveX -= currentTargetBoundingBox.x;
            moveY -= currentTargetBoundingBox.y;

            touchSource.strokePath = `M ${moveX},${moveY}`;
            touchSource.strokeData = [[moveX, moveY]];
            touchSource.stroke = SVG(currentTarget).path().fill('none').stroke(touchSource.stroke.attr('stroke')).attr('stroke-width', touchSource.stroke.attr('stroke-width')).attr('stroke-linecap', 'round');
            touchSource.target = currentTarget;

            touchSource.stroke.plot(touchSource.strokePath);
          }
        }
      }
    }
  };

  if(Object.keys(touchesList).length === 1) {
    document.addEventListener('touchmove', inputMoveHandler);
    document.addEventListener('mousemove', inputMoveHandler);
  }

  const inputUpHandler = (event) => {
    let isTouchEvent = (window.TouchEvent !== void 0 && event instanceof TouchEvent === true);
    let isMouseEvent = (window.MouseEvent !== void 0 && event instanceof MouseEvent === true);

    if(isTouchEvent === true) {
      for(let touch of event.changedTouches) {
        let touchSource = (touchesList.hasOwnProperty(touch.identifier) ? touchesList[touch.identifier] : null);

        if(touchSource !== null) {
          touchSource.stroke.plot(strokeToPath(touchSource.strokeData, pathCommandBezier));

          touchSource.strokePath = '';
          touchSource.strokeData = [];
          touchSource.stroke = null;

          delete touchesList[touch.identifier];
        }
      }
    }
    else {
      let touchSource = (touchesList.hasOwnProperty(uid) ? touchesList[uid] : null);

      if(touchSource !== null) {
        touchSource.stroke.plot(strokeToPath(touchSource.strokeData, pathCommandBezier));

        touchSource.strokePath = '';
        touchSource.strokeData = [];
        touchSource.stroke = null;

        delete touchesList[uid];
      }
    }

    if(Object.keys(touchesList).length === 0) {
      document.removeEventListener('mouseleave', inputUpHandler);
      document.removeEventListener('touchecancel', inputUpHandler);

      document.removeEventListener('mouseup', inputUpHandler);
      document.removeEventListener('touchend', inputUpHandler);

      document.removeEventListener('mousemove', inputMoveHandler);
      document.removeEventListener('touchmove', inputMoveHandler);        
    }
  };

  if(Object.keys(touchesList).length === 1) {
    document.addEventListener('touchend', inputUpHandler);
    document.addEventListener('mouseup', inputUpHandler);

    document.addEventListener('touchecancel', inputUpHandler);
    document.addEventListener('mouseleave', inputUpHandler);
  }
};

const inputDownDragHandler = (event) => {
  let target = null;
  let targetElement = event.target;

  while(targetElement !== document) {
    if(targetElement.classList.contains('draggable') === true) {
      target = targetElement;

      break;
    }

    targetElement = targetElement.parentNode;
  }

  if(target === null) {
    return;
  }

  let lastX = (event.changedTouches !== void 0 ? event.changedTouches[0] : event).clientX;
  let lastY = (event.changedTouches !== void 0 ? event.changedTouches[0] : event).clientY;

  const inputMoveHandler = (event) => {
    let boundingBox = target.getBoundingClientRect();

    let currentX = (event.changedTouches !== void 0 ? event.changedTouches[0] : event).clientX;
    let currentY = (event.changedTouches !== void 0 ? event.changedTouches[0] : event).clientY;

    target.style.left = `${boundingBox.x + currentX - lastX}px`;
    target.style.top = `${boundingBox.y + currentY - lastY}px`;

    lastX = currentX;
    lastY = currentY;
  };

  target.addEventListener('mousemove', inputMoveHandler);
  target.addEventListener('touchmove', inputMoveHandler);

  const inputUpHandler = (event) => {
    target.removeEventListener('touchleave', inputUpHandler);
    target.removeEventListener('touchend', inputUpHandler);
    target.removeEventListener('mouseleave', inputUpHandler);
    target.removeEventListener('mouseup', inputUpHandler);
    target.removeEventListener('touchmove', inputMoveHandler);
    target.removeEventListener('mousemove', inputMoveHandler);
  };

  target.addEventListener('mouseup', inputUpHandler);
  target.addEventListener('mouseleave', inputUpHandler);

  target.addEventListener('touchend', inputUpHandler);
  target.addEventListener('touchleave', inputUpHandler);
};

const inputDownNoteHandler = (event) => {
  let target = null;
  let targetElement = event.target;

  while(targetElement !== document) {
    if(targetElement.classList.contains('note') === true || targetElement.classList.contains('classroom') === true) {
      target = targetElement;

      break;
    }

    targetElement = targetElement.parentNode;
  }

  if(target === null) {
    return;
  }

  if(target.classList.contains('classroom') === true) {
    const uid = guid();

    let div = document.createElement('div');

    div.setAttribute('class', 'note draggable');
    div.setAttribute('id', `note-${uid}`);

    div.style.left = `${event.clientX - 100}px`;
    div.style.top = `${event.clientY - 100}px`;

    document.getElementById('classroom').appendChild(div);

    let titlebar = document.createElement('div');

    titlebar.classList.add('titlebar');

    div.appendChild(titlebar);

    let textarea = document.createElement('textarea');

    textarea.addEventListener('focus', (event) => {
      svg.classList.add('disabled');
    });

    textarea.addEventListener('blur', (event) => {
      svg.classList.remove('disabled');
    });

    div.appendChild(textarea);

    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svg.setAttribute('id', `note-${uid}-svg`);
    svg.setAttribute('class', 'disabled');

    div.appendChild(svg);

    SVG(`#note-${uid}-svg`).size('100%', '100%');

    setTimeout(() => textarea.focus(), 0);
  }
  else {
    let textarea = target.querySelector('textarea');

    setTimeout(() => textarea.focus(), 0);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  whiteboard = SVG('#whiteboard').size('100%', '100%');

  const inputDownHandler = (event) => {
    let target = null;
    let targetElement = event.target;

    while(targetElement !== document) {
      if(targetElement.classList.contains('titlebar') === true || targetElement.classList.contains('note') === true || targetElement.classList.contains('classroom') === true) {
        target = targetElement;

        break;
      }

      targetElement = targetElement.parentNode;
    }

    if(target === null) {
      return;
    }

    if(target.classList.contains('titlebar') === true) {
      return inputDownDragHandler(event);
    }
    else if(target.classList.contains('note') === true) {
      let downPosition = (event.touches !== void 0 ? event.touches[0] : event)
      let titlebar = target.querySelector('.titlebar');
      let boundingBox = titlebar.getBoundingClientRect();

      if(downPosition.clientX >= boundingBox.x && downPosition.clientX <= boundingBox.right && downPosition.clientY >= boundingBox.y && downPosition.clientY <= boundingBox.bottom) {
        return inputDownDragHandler(event);
      }
    }

    if(selectedMode === 'draw' || selectedMode === 'highlight') {
      return inputDownDrawHandler(event);
    }

    if(selectedMode === 'drag') {
      return inputDownDragHandler(event);
    }

    if(selectedMode === 'note') {
      return inputDownNoteHandler(event);
    }
  };

  document.addEventListener('touchstart', inputDownHandler);
  document.addEventListener('mousedown', inputDownHandler);

  setMode('draw');
});

const setMode = (inMode) => {
  if(inMode === 'draw') {
    strokeColorAlpha = 1;
  }
  else if(inMode === 'highlight') {
    strokeColorAlpha = 0.5;
  }

  selectedMode = inMode;
};

const setStrokeWidth = (inSize) => strokeWidth = inSize;

const setStrokeColor = (inColor) => strokeColor = inColor;
