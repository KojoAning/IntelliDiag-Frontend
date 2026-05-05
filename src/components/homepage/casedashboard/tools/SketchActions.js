import React from "react";

function SketchActions({ handleUndo, handleRedo, handleClear, handleEraser }) {
  return (
    <div>
      <button onClick={handleUndo}>Undo</button>
      <button onClick={handleRedo}>Redo</button>
      <button onClick={handleClear}>Clear</button>
      <button onClick={handleEraser}>Eraser</button>
    </div>
  );
}

export default SketchActions;
