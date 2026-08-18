// import React, { useRef, useState, useEffect } from "react";
// import {
//   Stage, Layer,
//   Image    as KonvaImage,
//   Rect     as KonvaRect,
//   Circle   as KonvaCircle,
//   Arrow    as KonvaArrow,
//   Line     as KonvaLine,
//   Text     as KonvaText,
//   Group    as KonvaGroup,
// } from "react-konva";
// import Konva from "konva";
// import { v4 as uuid } from "uuid";
// import Annotation from "./Annotations";

// const DRAW_C    = "#0694FB";
// const MEASURE_C = "#F59E0B";
// const MARKER_C  = "#22C55E";
// const SW = 2;

// const dist = (x1,y1,x2,y2) => Math.round(Math.sqrt((x2-x1)**2+(y2-y1)**2));
// const angleDeg = (cx,cy,x1,y1,x2,y2) => {
//   let d = Math.abs((Math.atan2(y2-cy,x2-cx)-Math.atan2(y1-cy,x1-cx))*180/Math.PI);
//   if (d > 180) d = 360 - d;
//   return Math.round(d);
// };
// const mid = (x1,y1,x2,y2) => ({ x:(x1+x2)/2, y:(y1+y2)/2 });

// function CustomCanvas({
//   toolMode, action, wlMode,
//   selectedImage, brightness, contrast, inverted,
//   zoom, rotation, flipH, flipV,
// }) {
//   const containerRef = useRef(null);
//   const stageRef     = useRef(null);
//   const imageRef     = useRef(null);

//   // Container dimensions
//   const [size, setSize] = useState({ w: 800, h: 600 });
//   useEffect(() => {
//     if (!containerRef.current) return;
//     const obs = new ResizeObserver(([e]) =>
//       setSize({ w: e.contentRect.width, h: e.contentRect.height })
//     );
//     obs.observe(containerRef.current);
//     return () => obs.disconnect();
//   }, []);

//   // Load image
//   const [imgObj,  setImgObj]  = useState(null);
//   const [imgNatW, setImgNatW] = useState(0);
//   const [imgNatH, setImgNatH] = useState(0);
//   useEffect(() => {
//     if (!selectedImage) { setImgObj(null); return; }
//     const img = new window.Image();
//     img.onload = () => { setImgObj(img); setImgNatW(img.naturalWidth); setImgNatH(img.naturalHeight); };
//     img.src = selectedImage;
//   }, [selectedImage]);

//   // Konva filters (brightness/contrast/invert)
//   useEffect(() => {
//     if (!imageRef.current || !imgObj) return;
//     imageRef.current.cache();
//     imageRef.current.getLayer()?.batchDraw();
//   }, [imgObj, brightness, contrast, inverted, size]);

//   // Fit image into stage while preserving aspect ratio
//   const aspect   = imgNatW && imgNatH ? imgNatW / imgNatH : 1;
//   const fitW     = Math.min(size.w, size.h * aspect);
//   const fitH     = fitW / aspect;
//   const imgX     = (size.w - fitW) / 2;
//   const imgY     = (size.h - fitH) / 2;

//   // Shapes
//   const [rects,   setRects]   = useState([]);
//   const [circles, setCircles] = useState([]);
//   const [arrows,  setArrows]  = useState([]);
//   const [drawing, setDrawing] = useState(null);

//   // Measurements
//   const [rulers,  setRulers]  = useState([]);
//   const [angles,  setAngles]  = useState([]);
//   const [markers, setMarkers] = useState([]);
//   const [mip,     setMip]     = useState(null); // measurement-in-progress
//   const [mouse,   setMouse]   = useState({ x: 0, y: 0 });

//   const [selectedId, setSelectedId] = useState(null);

//   // History
//   const snap0 = { rects:[],circles:[],arrows:[],rulers:[],angles:[],markers:[] };
//   const [history, setHistory] = useState([snap0]);
//   const [histIdx, setHistIdx] = useState(0);

//   const push = (r,c,a,ru,an,ma) => {
//     const s = {rects:r,circles:c,arrows:a,rulers:ru,angles:an,markers:ma};
//     setHistory(h => [...h.slice(0, histIdx+1), s]);
//     setHistIdx(i => i+1);
//   };
//   const apply = s => {
//     setRects(s.rects); setCircles(s.circles); setArrows(s.arrows);
//     setRulers(s.rulers); setAngles(s.angles); setMarkers(s.markers);
//   };

//   useEffect(() => {
//     if (!action) return;
//     const {type} = action;
//     if (type === "undo") setHistIdx(i => { const n=Math.max(0,i-1); apply(history[n]); return n; });
//     if (type === "redo") setHistIdx(i => { const n=Math.min(history.length-1,i+1); apply(history[n]); return n; });
//     if (type === "clear") {
//       setRects([]); setCircles([]); setArrows([]);
//       setRulers([]); setAngles([]); setMarkers([]);
//       setMip(null); setSelectedId(null);
//       push([],[],[],[],[],[]);
//     }
//     if (type === "eraser" && selectedId) {
//       const nr=rects.filter(s=>s.id!==selectedId), nc=circles.filter(s=>s.id!==selectedId), na=arrows.filter(s=>s.id!==selectedId);
//       const nru=rulers.filter(s=>s.id!==selectedId), nan=angles.filter(s=>s.id!==selectedId), nma=markers.filter(s=>s.id!==selectedId);
//       setRects(nr); setCircles(nc); setArrows(na); setRulers(nru); setAngles(nan); setMarkers(nma);
//       push(nr,nc,na,nru,nan,nma); setSelectedId(null);
//     }
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [action]);

//   // Get pointer in stage-local (image-space) coords, accounting for all stage transforms
//   const getPos = () => {
//     const stage = stageRef.current;
//     if (!stage) return { x:0, y:0 };
//     const raw = stage.getPointerPosition();
//     const t   = stage.getAbsoluteTransform().copy().invert();
//     return t.point(raw);
//   };

//   const handleMouseMove = (e) => {
//     const pos = getPos();
//     setMouse(pos);
//     if (wlMode) return;
//     if (!drawing) return;
//     if (drawing.type === "rect")   setDrawing(d => ({...d, width:pos.x-d.x, height:pos.y-d.y}));
//     if (drawing.type === "circle") {
//       const dx=pos.x-drawing.x, dy=pos.y-drawing.y;
//       setDrawing(d => ({...d, radius:Math.sqrt(dx*dx+dy*dy)}));
//     }
//     if (drawing.type === "arrow")  setDrawing(d => ({...d, points:[d.points[0],d.points[1],pos.x,pos.y]}));
//   };

//   const handleMouseDown = (e) => {
//     if (wlMode) return;
//     const pos = getPos();
//     if (e.target === e.target.getStage()) setSelectedId(null);

//     if (toolMode === "square") { setDrawing({type:"rect",  id:uuid(),x:pos.x,y:pos.y,width:0,height:0}); return; }
//     if (toolMode === "circle") { setDrawing({type:"circle",id:uuid(),x:pos.x,y:pos.y,radius:0}); return; }
//     if (toolMode === "arrow")  { setDrawing({type:"arrow", id:uuid(),points:[pos.x,pos.y,pos.x,pos.y]}); return; }

//     if (toolMode === "ruler") {
//       if (!mip) { setMip({tool:"ruler",x1:pos.x,y1:pos.y}); }
//       else {
//         const nr=[...rulers,{id:uuid(),x1:mip.x1,y1:mip.y1,x2:pos.x,y2:pos.y}];
//         setRulers(nr); push(rects,circles,arrows,nr,angles,markers); setMip(null);
//       }
//       return;
//     }
//     if (toolMode === "angle") {
//       if (!mip)               setMip({tool:"angle",phase:1,cx:pos.x,cy:pos.y});
//       else if (mip.phase===1) setMip({...mip,phase:2,x1:pos.x,y1:pos.y});
//       else {
//         const na=[...angles,{id:uuid(),cx:mip.cx,cy:mip.cy,x1:mip.x1,y1:mip.y1,x2:pos.x,y2:pos.y}];
//         setAngles(na); push(rects,circles,arrows,rulers,na,markers); setMip(null);
//       }
//       return;
//     }
//     if (toolMode === "marker") {
//       const nm=[...markers,{id:uuid(),x:pos.x,y:pos.y,label:String(markers.length+1)}];
//       setMarkers(nm); push(rects,circles,arrows,rulers,angles,nm);
//       return;
//     }
//   };

//   const handleMouseUp = () => {
//     if (wlMode || !drawing) return;
//     let nr=rects, nc=circles, na=arrows;
//     if (drawing.type==="rect"   && (Math.abs(drawing.width)>4||Math.abs(drawing.height)>4)) { nr=[...rects,drawing];   setRects(nr); }
//     if (drawing.type==="circle" && drawing.radius>4)                                          { nc=[...circles,drawing]; setCircles(nc); }
//     if (drawing.type==="arrow") {
//       const dx=drawing.points[2]-drawing.points[0], dy=drawing.points[3]-drawing.points[1];
//       if (Math.sqrt(dx*dx+dy*dy)>4) { na=[...arrows,drawing]; setArrows(na); }
//     }
//     push(nr,nc,na,rulers,angles,markers);
//     setDrawing(null);
//   };

//   const handleKeyDown = (e) => {
//     if (e.key==="Escape") { setMip(null); setDrawing(null); return; }
//     if ((e.keyCode===8||e.keyCode===46) && selectedId) {
//       const nr=rects.filter(s=>s.id!==selectedId), nc=circles.filter(s=>s.id!==selectedId), na=arrows.filter(s=>s.id!==selectedId);
//       const nru=rulers.filter(s=>s.id!==selectedId), nan=angles.filter(s=>s.id!==selectedId), nma=markers.filter(s=>s.id!==selectedId);
//       setRects(nr); setCircles(nc); setArrows(na); setRulers(nru); setAngles(nan); setMarkers(nma);
//       push(nr,nc,na,nru,nan,nma); setSelectedId(null);
//     }
//   };

//   const activeTool = ["square","circle","arrow","ruler","angle","marker"].includes(toolMode);
//   const cursor = wlMode ? "crosshair" : activeTool ? "crosshair" : "default";
//   const lx = mouse.x, ly = mouse.y;

//   const konvaFilters = [
//     Konva.Filters.Brighten,
//     Konva.Filters.Contrast,
//     ...(inverted ? [Konva.Filters.Invert] : []),
//   ];

//   return (
//     <div
//       ref={containerRef}
//       tabIndex={0}
//       onKeyDown={handleKeyDown}
//       style={{ width:"100%", height:"100%", outline:"none" }}
//     >
//       <Stage
//         ref={stageRef}
//         width={size.w}
//         height={size.h}
//         // Pivot at centre so zoom/rotate/flip are centred
//         x={size.w / 2}  y={size.h / 2}
//         offsetX={size.w / 2} offsetY={size.h / 2}
//         rotation={rotation}
//         scaleX={zoom * (flipH ? -1 : 1)}
//         scaleY={zoom * (flipV ? -1 : 1)}
//         style={{ cursor }}
//         onMouseDown={handleMouseDown}
//         onMouseMove={handleMouseMove}
//         onMouseUp={handleMouseUp}
//       >
//         {/* ── Image layer (non-interactive) ── */}
//         <Layer listening={false}>
//           {imgObj && (
//             <KonvaImage
//               ref={imageRef}
//               image={imgObj}
//               x={imgX} y={imgY}
//               width={fitW} height={fitH}
//               filters={konvaFilters}
//               brightness={brightness - 1}
//               contrast={(contrast - 1) * 100}
//             />
//           )}
//         </Layer>

//         {/* ── Annotation + measurement layer ── */}
//         <Layer>
//           {/* Rects */}
//           {rects.map(r => (
//             <Annotation key={r.id} shapeProps={r}
//               isSelected={r.id===selectedId}
//               onSelect={()=>setSelectedId(r.id)}
//               onChange={attrs => { const nr=rects.map(s=>s.id===r.id?attrs:s); setRects(nr); push(nr,circles,arrows,rulers,angles,markers); }}
//             />
//           ))}

//           {/* Circles */}
//           {circles.map(c => (
//             <KonvaCircle key={c.id} id={c.id} x={c.x} y={c.y} radius={c.radius}
//               stroke={c.id===selectedId?"#fff":DRAW_C} strokeWidth={SW} fill="transparent" draggable
//               onClick={()=>setSelectedId(c.id)}
//               onDragEnd={e=>{
//                 const nc=circles.map(s=>s.id===c.id?{...s,x:e.target.x(),y:e.target.y()}:s);
//                 setCircles(nc); push(rects,nc,arrows,rulers,angles,markers);
//               }}
//             />
//           ))}

//           {/* Arrows */}
//           {arrows.map(a => (
//             <KonvaArrow key={a.id} id={a.id} points={a.points}
//               stroke={a.id===selectedId?"#fff":DRAW_C} fill={a.id===selectedId?"#fff":DRAW_C}
//               strokeWidth={SW} draggable
//               onClick={()=>setSelectedId(a.id)}
//               onDragEnd={e=>{
//                 const dx=e.target.x(), dy=e.target.y();
//                 const na=arrows.map(s=>s.id===a.id?{...s,points:[s.points[0]+dx,s.points[1]+dy,s.points[2]+dx,s.points[3]+dy]}:s);
//                 setArrows(na); push(rects,circles,na,rulers,angles,markers); e.target.position({x:0,y:0});
//               }}
//             />
//           ))}

//           {/* In-progress draw */}
//           {drawing?.type==="rect"   && <KonvaRect   x={drawing.x} y={drawing.y} width={drawing.width} height={drawing.height} stroke={DRAW_C} strokeWidth={SW} fill="transparent" dash={[4,3]} />}
//           {drawing?.type==="circle" && <KonvaCircle x={drawing.x} y={drawing.y} radius={drawing.radius} stroke={DRAW_C} strokeWidth={SW} fill="transparent" dash={[4,3]} />}
//           {drawing?.type==="arrow"  && <KonvaArrow  points={drawing.points} stroke={DRAW_C} fill={DRAW_C} strokeWidth={SW} dash={[4,3]} />}

//           {/* Rulers */}
//           {rulers.map(r => {
//             const m=mid(r.x1,r.y1,r.x2,r.y2), d=dist(r.x1,r.y1,r.x2,r.y2), sel=r.id===selectedId;
//             return (
//               <KonvaGroup key={r.id} draggable onClick={()=>setSelectedId(r.id)}
//                 onDragEnd={e=>{
//                   const dx=e.target.x(), dy=e.target.y();
//                   const nr=rulers.map(s=>s.id===r.id?{...s,x1:s.x1+dx,y1:s.y1+dy,x2:s.x2+dx,y2:s.y2+dy}:s);
//                   setRulers(nr); push(rects,circles,arrows,nr,angles,markers); e.target.position({x:0,y:0});
//                 }}>
//                 <KonvaLine points={[r.x1,r.y1,r.x2,r.y2]} stroke={sel?"#fff":MEASURE_C} strokeWidth={SW} />
//                 <KonvaCircle x={r.x1} y={r.y1} radius={3} fill={sel?"#fff":MEASURE_C} />
//                 <KonvaCircle x={r.x2} y={r.y2} radius={3} fill={sel?"#fff":MEASURE_C} />
//                 <KonvaRect x={m.x-24} y={m.y-11} width={48} height={18} fill="rgba(0,0,0,0.7)" cornerRadius={4} />
//                 <KonvaText x={m.x-24} y={m.y-8} width={48} align="center" text={`${d}px`} fontSize={10} fontFamily="monospace" fill={MEASURE_C} />
//               </KonvaGroup>
//             );
//           })}

//           {/* Ruler in-progress */}
//           {mip?.tool==="ruler" && (() => {
//             const m=mid(mip.x1,mip.y1,lx,ly), d=dist(mip.x1,mip.y1,lx,ly);
//             return <>
//               <KonvaLine points={[mip.x1,mip.y1,lx,ly]} stroke={MEASURE_C} strokeWidth={SW} dash={[5,4]} />
//               <KonvaCircle x={mip.x1} y={mip.y1} radius={3} fill={MEASURE_C} />
//               <KonvaRect x={m.x-24} y={m.y-11} width={48} height={18} fill="rgba(0,0,0,0.7)" cornerRadius={4} />
//               <KonvaText x={m.x-24} y={m.y-8} width={48} align="center" text={`${d}px`} fontSize={10} fontFamily="monospace" fill={MEASURE_C} />
//             </>;
//           })()}

//           {/* Angles */}
//           {angles.map(a => {
//             const deg=angleDeg(a.cx,a.cy,a.x1,a.y1,a.x2,a.y2), sel=a.id===selectedId, c=sel?"#fff":MEASURE_C;
//             return (
//               <KonvaGroup key={a.id} draggable onClick={()=>setSelectedId(a.id)}
//                 onDragEnd={e=>{
//                   const dx=e.target.x(), dy=e.target.y();
//                   const na=angles.map(s=>s.id===a.id?{...s,cx:s.cx+dx,cy:s.cy+dy,x1:s.x1+dx,y1:s.y1+dy,x2:s.x2+dx,y2:s.y2+dy}:s);
//                   setAngles(na); push(rects,circles,arrows,rulers,na,markers); e.target.position({x:0,y:0});
//                 }}>
//                 <KonvaLine points={[a.cx,a.cy,a.x1,a.y1]} stroke={c} strokeWidth={SW} />
//                 <KonvaLine points={[a.cx,a.cy,a.x2,a.y2]} stroke={c} strokeWidth={SW} />
//                 <KonvaCircle x={a.cx} y={a.cy} radius={3} fill={c} />
//                 <KonvaRect x={a.cx+6} y={a.cy-13} width={44} height={18} fill="rgba(0,0,0,0.7)" cornerRadius={4} />
//                 <KonvaText x={a.cx+6} y={a.cy-10} text={`${deg}°`} fontSize={12} fontFamily="monospace" fill={MEASURE_C} fontStyle="bold" />
//               </KonvaGroup>
//             );
//           })}

//           {/* Angle in-progress */}
//           {mip?.tool==="angle" && mip.phase===1 && <>
//             <KonvaLine points={[mip.cx,mip.cy,lx,ly]} stroke={MEASURE_C} strokeWidth={SW} dash={[5,4]} />
//             <KonvaCircle x={mip.cx} y={mip.cy} radius={3} fill={MEASURE_C} />
//           </>}
//           {mip?.tool==="angle" && mip.phase===2 && <>
//             <KonvaLine points={[mip.cx,mip.cy,mip.x1,mip.y1]} stroke={MEASURE_C} strokeWidth={SW} />
//             <KonvaLine points={[mip.cx,mip.cy,lx,ly]} stroke={MEASURE_C} strokeWidth={SW} dash={[5,4]} />
//             <KonvaCircle x={mip.cx} y={mip.cy} radius={3} fill={MEASURE_C} />
//             <KonvaRect x={mip.cx+6} y={mip.cy-13} width={44} height={18} fill="rgba(0,0,0,0.7)" cornerRadius={4} />
//             <KonvaText x={mip.cx+6} y={mip.cy-10} text={`${angleDeg(mip.cx,mip.cy,mip.x1,mip.y1,lx,ly)}°`} fontSize={12} fontFamily="monospace" fill={MEASURE_C} fontStyle="bold" />
//           </>}

//           {/* Markers */}
//           {markers.map(m => (
//             <KonvaGroup key={m.id} draggable onClick={()=>setSelectedId(m.id)}
//               onDragEnd={e=>{
//                 const nm=markers.map(s=>s.id===m.id?{...s,x:s.x+e.target.x(),y:s.y+e.target.y()}:s);
//                 setMarkers(nm); push(rects,circles,arrows,rulers,angles,nm); e.target.position({x:0,y:0});
//               }}>
//               <KonvaCircle x={m.x} y={m.y} radius={6} fill={m.id===selectedId?"#fff":MARKER_C} stroke={m.id===selectedId?"#fff":"rgba(34,197,94,0.3)"} strokeWidth={4} />
//               <KonvaText x={m.x+10} y={m.y-7} text={m.label} fontSize={11} fontFamily="monospace" fill={MARKER_C} fontStyle="bold" />
//             </KonvaGroup>
//           ))}

//           {/* Marker cursor */}
//           {toolMode==="marker" && <KonvaCircle x={lx} y={ly} radius={6} stroke={MARKER_C} strokeWidth={2} fill="transparent" dash={[3,2]} />}
//         </Layer>
//       </Stage>
//     </div>
//   );
// }

// export default CustomCanvas;
