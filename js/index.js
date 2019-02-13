let whiteboard = null;
let touchesList = {};
let selectedMode = 'draw';
let strokeColor = '#ff0000';
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

const rgbToHexColor = (inR, inG, inB) => {
  let r = Math.min(Math.max(0, inR), 255).toString(16);
  let g = Math.min(Math.max(0, inG), 255).toString(16);
  let b = Math.min(Math.max(0, inB), 255).toString(16);

  if(r < 16) {
    r = `0${r}`;
  }

  if(g < 16) {
    g = `0${g}`;
  }

  if(b < 16) {
    b = `0${b}`;
  }

  return `#${r}${g}${b}`;
};

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
  let isTouchEvent = event instanceof TouchEvent;
  let isMouseEvent = event instanceof MouseEvent;

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

        let color = (strokeColor !== 'random' ? strokeColor : rgbToHexColor(parseInt(Math.random() * 256),parseInt(Math.random() * 256),parseInt(Math.random() * 256)));

        stroke = SVG(target).path().fill('none').stroke(color).attr('stroke-width', strokeWidth).attr('stroke-linecap', 'round');

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

      let color = (strokeColor !== 'random' ? strokeColor : rgbToHexColor(parseInt(Math.random() * 256),parseInt(Math.random() * 256),parseInt(Math.random() * 256)));

      stroke = SVG(target).path().fill('none').stroke(color).attr('stroke-width', strokeWidth).attr('stroke-linecap', 'round');

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
    let isTouchEvent = event instanceof TouchEvent;
    let isMouseEvent = event instanceof MouseEvent;

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
              touchSource.stroke = SVG(currentTarget).path().fill('none').stroke(touchSource.stroke.attr('stroke')).attr('stroke-width', touchSource.stroke.attr('stroke-width')).attr('stroke-linecap', 'round');
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
    let isTouchEvent = event instanceof TouchEvent;
    let isMouseEvent = event instanceof MouseEvent;

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


document.addEventListener('DOMContentLoaded', () => {
  whiteboard = SVG('#whiteboard').size('100%', '100%');

  const inputDownHandler = (event) => {
    if(selectedMode === 'draw') {
      return inputDownDrawHandler(event);
    }

    if(selectedMode === 'drag') {
      // TODO
    }

    if(selectedMode === 'note') {
      // TODO
    }
  };

  document.addEventListener('touchstart', inputDownHandler);
  document.addEventListener('mousedown', inputDownHandler);
});

const setMode = (inMode) => selectedMode = inMode;

const setColor = (inColor) => strokeColor = inColor;
