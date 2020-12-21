import { TAG_ROOT } from "./constants";
import { schedulerRoot } from "./scheduler";

function render(element, container) {
  let rootFiber = {
    tag: TAG_ROOT,
    stateNode: container,
    props: { children: [element] },
  };

  schedulerRoot(rootFiber);
}

const ReactDOM = { render };
export default ReactDOM;
