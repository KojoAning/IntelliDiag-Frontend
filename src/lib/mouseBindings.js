// Horos/OsiriX mouse layout, shared by the 2D and MPR viewers:
//   left   = the chosen tool (window/level unless the user picks another), or nothing in
//            pointer mode — only grabbing measurements / crosshair lines
//   middle = pan
//   right  = zoom
// The wheel (slice scrolling) is bound separately and left alone here.
import { Enums as csToolsEnums, WindowLevelTool, PanTool, ZoomTool } from "@cornerstonejs/tools";

const { MouseBindings } = csToolsEnums;

// Rebuilt from scratch on every change: ToolGroup.setToolActive *adds* bindings to a
// tool's existing ones, so incremental switching leaves stale bindings behind (e.g.
// switching W/L off used to drop its middle-button binding as well).
//
// interactiveTools stay Passive when they aren't on the left button, so an existing
// measurement — or an MPR crosshair line — can still be grabbed and edited whatever
// tool is active, as in Horos.
// extraBindings: { [toolName]: [binding, ...] } for viewer-specific extras (e.g. Shift+left pan).
// primary: tool name for the left button, or null for pointer mode.
export function applyHorosMouseBindings(toolGroup, { primary, interactiveTools = [], extraBindings = {} }) {
  const bindings = {
    [WindowLevelTool.toolName]: [],
    [PanTool.toolName]: [{ mouseButton: MouseBindings.Auxiliary }],
    [ZoomTool.toolName]: [{ mouseButton: MouseBindings.Secondary }],
  };
  Object.entries(extraBindings).forEach(([name, extra]) => {
    bindings[name] = [...(bindings[name] ?? []), ...extra];
  });
  if (primary) bindings[primary] = [...(bindings[primary] ?? []), { mouseButton: MouseBindings.Primary }];

  new Set([...Object.keys(bindings), ...interactiveTools]).forEach(name => {
    try { toolGroup.setToolPassive(name, { removeAllBindings: true }); } catch (_) {}
  });
  Object.entries(bindings).forEach(([name, toolBindings]) => {
    if (toolBindings.length) toolGroup.setToolActive(name, { bindings: toolBindings });
  });
}
