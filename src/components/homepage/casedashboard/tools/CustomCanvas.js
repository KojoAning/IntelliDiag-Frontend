import React, { useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect as KonvaRect,
  Image as KonvaImage,
  Circle as KonvaCircle,
  Line as KonvaLine,
  Arrow as KonvaArrow,
  Transformer,
} from "react-konva";
import { ReactSketchCanvas } from "react-sketch-canvas";
import { v4 as uuid } from "uuid";
import Annotation from "./Annotations";
const isDraggable = true;

function CustomCanvas({ isActive = false, currentAction }) {
  const canvasRef = useRef(null);

  const Canvas = class extends React.Component {
    constructor(props) {
      super(props);

      this.canvas = React.createRef();
    }
  };

  const [arrows, setArrows] = useState([]);

  const [newArrow, setNewArrow] = useState(null);
  // const initialAnnotations = [
  //   {
  //     x: 10,
  //     y: 10,
  //     width: 100,
  //     height: 100,
  //     id: uuid(),
  //   },
  //   {
  //     x: 150,
  //     y: 150,
  //     width: 100,
  //     height: 100,
  //     id: uuid(),
  //   },
  // ];

  const [annotations, setAnnotations] = useState([]);
  const [newAnnotation, setNewAnnotation] = useState([]);
  const [selectedId, selectAnnotation] = useState(null);
  const [canvasMeasures, setCanvasMeasures] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const handleMouseDown = (event) => {
    const clickedOnEmpty = event.target === event.target.getStage();
    const pos = event.target.getStage().getPointerPosition(); 

    if (currentAction === "arrow") {
      const id = uuid();
      setNewArrow({
        id,
        points: [pos.x, pos.y, pos.x, pos.y], // start + end initially same
        color: "red",
      });
      return;
    }

    if (clickedOnEmpty) {
      // Always unselect if clicking on empty space
      selectAnnotation(null);

      // If no annotation is selected, start drawing
      if (newAnnotation.length === 0) {
        const { x, y } = event.target.getStage().getPointerPosition();
        const id = uuid();
        setNewAnnotation([{ x, y, width: 0, height: 0, id }]);
      }
      // if (currentAction == "rectangle") {
      //   setCircles((prevCircles) => [
      //     ...prevCircles,
      //     {
      //       id,
      //       radius: 1,
      //       x,
      //       y,
      //       color,
      //     },
      //   ]);
      // }
      return;
    }

    // Clicked on shape → do nothing here (selection handled in Annotation)
  };

  const handleMouseMove = (event) => {
    if (selectedId === null && newAnnotation.length === 1) {
      const sx = newAnnotation[0].x;
      const sy = newAnnotation[0].y;
      const { x, y } = event.target.getStage().getPointerPosition();
      const id = uuid();
      setNewAnnotation([
        {
          x: sx,
          y: sy,
          width: x - sx,
          height: y - sy,
          id,
        },
      ]);
    }

    if (currentAction === "arrow" && newArrow) {
      const pos = event.target.getStage().getPointerPosition();
      setNewArrow({
        ...newArrow,
        points: [newArrow.points[0], newArrow.points[1], pos.x, pos.y],
      });
      return;
    }
  };

  const handleMouseUp = () => {
    if (selectedId === null && newAnnotation.length === 1) {
      annotations.push(...newAnnotation);
      setAnnotations(annotations);
      setNewAnnotation([]);
    }

    if (currentAction === "arrow" && newArrow) {
      setArrows([...arrows, newArrow]);
      setNewArrow(null);
      return;
    }
  };

  const handleMouseEnter = (event) => {
    event.target.getStage().container().style.cursor = "crosshair";
  };

  const handleKeyDown = (event) => {
    if (event.keyCode === 8 || event.keyCode === 46) {
      if (selectedId !== null) {
        const newAnnotations = annotations.filter(
          (annotation) => annotation.id !== selectedId
        );
        setAnnotations(newAnnotations);
      }
    }
  };

  const annotationsToDraw = [...annotations, ...newAnnotation];

  return (
    <div tabIndex={1} onKeyDown={handleKeyDown}>
      <Stage
        width={canvasMeasures.width}
        height={canvasMeasures.height}
        onMouseEnter={handleMouseEnter}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer>
          {currentAction === "arrow" ? (
             arrows.map((arrow) => (
      <KonvaArrow
        key={arrow.id}
        id={arrow.id}
        points={arrow.points}
        fill={arrow.color}
        stroke={arrow.color}
        strokeWidth={4}
        draggable={isDraggable}
      />
    ))
    
          ) : currentAction == "square" ? (
            annotationsToDraw.map((annotation, i) => {
              return (
                <Annotation
                  key={i}
                  shapeProps={annotation}
                  isSelected={annotation.id === selectedId}
                  onSelect={() => {
                    selectAnnotation(annotation.id);
                  }}
                  onChange={(newAttrs) => {
                    const rects = annotations.slice();
                    rects[i] = newAttrs;
                    setAnnotations(rects);
                  }}
                />
              );
            })
          ) : (
            <div></div>
          )}
        </Layer>
      </Stage>
    </div>
  );
}

export default CustomCanvas;
