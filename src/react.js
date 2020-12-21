import { ELEMENT_TEXT } from "./constants";
import { schedulerRoot } from "./scheduler";
import { Update } from "./updateQueue";

function createElement(type, config, ...children) {
  delete config.__self;
  delete config.__source;
  return {
    type,
    props: {
      ...config,
      children: children.map((child) => {
        return typeof child === "object"
          ? child
          : { type: ELEMENT_TEXT, props: { text: child, children: [] } };
      }),
    },
  };
}

class Component {
  constructor(props) {
    this.props = props;
    // this.updateQueue = new UpdateQueue();
  }

  setState(payload) {
    // 可能是对象，也可能是一个函数
    let update = new Update(payload);
    // updateQueue其实是放在此类组件对应的fiber节点上的 internalFiber
    this.internalFiber.updateQueue.enqueueUpdate(update);
    // this.updateQueue.enqueueUpdate(update);
    schedulerRoot(); // 从根节点开始调度
  }
}

Component.prototype.isReactComponent = {}; // 标记类组件

const React = { createElement, Component };
export default React;
