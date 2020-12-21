import { TAG_ROOT } from "./constants";
import { schedulerRoot } from "./scheduler";

/**
 * render是要把一个元素渲染到一个容器内部
 */
function render(element, container) {
  let rootFiber = {
    tag: TAG_ROOT, // 每个fiber都会有一个tag标识此元素的类型
    stateNode: container,
    props: { children: [element] },
  };

  schedulerRoot(rootFiber);
}

const ReactDOM = { render };
export default ReactDOM;
