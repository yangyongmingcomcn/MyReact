import {
  UPDATE,
  TAG_TEXT,
  TAG_HOST,
  TAG_ROOT,
  DELETION,
  TAG_CLASS,
  PLACEMENT,
  ELEMENT_TEXT,
} from "./constants";
import { setProps } from "./utils";
import { UpdateQueue } from "./updateQueue";

/**
 * 从根节点开始渲染和调度 两个阶段
 * diff阶段 比较新旧虚拟DOM，进行增量更新或创建，render阶段
 * 这个阶段消耗时间较长，我们可以拆分任务，将虚拟DOM进行拆分，此阶段可以暂停
 * render阶段成果是effect list知道哪些节点更新哪些节点删除，新增了哪些节点
 * render阶段有两个任务 1、根据虚拟DOM生成Fiber树。2、收集effect list
 * commit阶段，进行DOM更新创建阶段，此阶段不能暂停
 */
let deletions = []; // 删除的节点不放在effect list中，使用deletions单独记录并执行
let currentRoot = null; // 渲染成功之后的当前树
let nextUnitOfWork = null; // 下一个工作单元
let workInProgressRoot = null; // RootFiber应用根
export function schedulerRoot(rootFiber) {
  if (currentRoot && currentRoot.alternate) {
    workInProgressRoot = currentRoot.alternate;
    workInProgressRoot.alternate = currentRoot;
    if (rootFiber) workInProgressRoot.props = rootFiber.props;
  } else if (currentRoot) {
    // 说明至少渲染过一次了
    if (rootFiber) {
      rootFiber.alternate = currentRoot;
      workInProgressRoot = rootFiber;
    } else {
      workInProgressRoot = {
        ...currentRoot,
        alternate: currentRoot,
      };
    }
  } else {
    // 说明是第一次渲染
    workInProgressRoot = rootFiber;
  }
  workInProgressRoot.firstEffect = workInProgressRoot.nextEffect = workInProgressRoot.lastEffect = null;
  nextUnitOfWork = workInProgressRoot;
}

function performUnitOfWork(currentFiber) {
  beginWork(currentFiber);
  if (currentFiber.child) {
    return currentFiber.child;
  }
  while (currentFiber) {
    completeUnitOfWork(currentFiber); // 没有儿子，就先让自己完成
    if (currentFiber.sibling) {
      // 看有没有弟弟
      return currentFiber.sibling; // 有弟弟返回弟弟
    }
    currentFiber = currentFiber.return; // 然后找父亲，让父亲完成
  }
}

/**
 * 在beginWork完成的时候，需要收集有副作用的fiber，组成effect list
 * 每个fiber有两个属性 firstEffect指向第一个有副作用的子fiber lastEffect指向最后一个有副作用的子fiber
 * 中间的用nextEffect做成一个单链表 firstEffect=>大儿子 lastEffect=>二儿子 。。。。
 */
function completeUnitOfWork(currentFiber) {
  let returnFiber = currentFiber.return;
  if (returnFiber) {
    // 把自己儿子的effect链挂到父亲上
    if (!returnFiber.firstEffect) {
      returnFiber.firstEffect = currentFiber.firstEffect;
    }
    if (!!currentFiber.lastEffect) {
      if (!!returnFiber.lastEffect) {
        returnFiber.lastEffect.nextEffect = currentFiber.firstEffect;
      }
      returnFiber.lastEffect = currentFiber.lastEffect;
    }
    // 把自己的effect链挂到父亲上
    const effectTag = currentFiber.effectTag;
    // 自己有副作用
    if (effectTag) {
      if (returnFiber.lastEffect) {
        returnFiber.lastEffect.nextEffect = currentFiber;
      } else {
        returnFiber.firstEffect = currentFiber;
      }
      returnFiber.lastEffect = currentFiber;
    }
  }
}

/**
 * beginWork 开始遍历子节点
 * completeUnitOfWork 子节点遍历完成，返回父节点
 * beginWork创建Fiber，在completeUnitOfWork的时候收集effect
 * beginWork：
 * 1、创建真实DOM元素
 * 2、创建子Fiber
 */
function beginWork(currentFiber) {
  if (currentFiber.tag === TAG_ROOT) {
    updateHostRoot(currentFiber);
  } else if (currentFiber.tag === TAG_TEXT) {
    updateHostText(currentFiber);
  } else if (currentFiber.tag === TAG_HOST) {
    updateHost(currentFiber);
  } else if (currentFiber.tag === TAG_CLASS) {
    updateClassComponent(currentFiber);
  }
}

function updateHostRoot(currentFiber) {
  // 先处理自己，如果是一个原生节点，创建真实DOM，2、创建Fiber
  let newChildren = currentFiber.props.children;
  reconcileChildren(currentFiber, newChildren);
}

function updateHostText(currentFiber) {
  if (!currentFiber.stateNode) {
    // 说明此fiber节点没有创建DOM节点
    currentFiber.stateNode = createDOM(currentFiber);
  }
}

function updateHost(currentFiber) {
  if (!currentFiber.stateNode) {
    // 说明此fiber节点没有创建DOM节点
    currentFiber.stateNode = createDOM(currentFiber);
  }
  let newChildren = currentFiber.props.children;
  reconcileChildren(currentFiber, newChildren);
}

function updateClassComponent(currentFiber) {
  if (!currentFiber.stateNode) {
    // new ClassCounter(); 类组件实例 fiber双向指向
    currentFiber.stateNode = new currentFiber.type(currentFiber.props);
    currentFiber.stateNode.internalFiber = currentFiber;
    // currentFiber.updateQueue = new UpdateQueue();
  }
  // 给组件的实例的state赋值
  currentFiber.stateNode.state = currentFiber.updateQueue.forceUpdate(
    currentFiber.stateNode.state
  );

  let newElement = currentFiber.stateNode.render();
  const newChildren = [newElement];
  reconcileChildren(currentFiber, newChildren);
}

function createDOM(currentFiber) {
  if (currentFiber.tag === TAG_TEXT) {
    return document.createTextNode(currentFiber.props.text);
  } else if (currentFiber.tag === TAG_HOST) {
    let stateNode = document.createElement(currentFiber.type);
    updateDOM(stateNode, {}, currentFiber.props);
    return stateNode;
  }
}

function updateDOM(stateNode, oldProps, newProps) {
  if (stateNode.setAttribute) {
    setProps(stateNode, oldProps, newProps);
  }
}

function reconcileChildren(currentFiber, newChildren) {
  let prevSibling; // 上一个新的子fiber
  let newChildrenIndex = 0; // 新子节点索引
  // 如果说currentFiber有alternate并且alternate有child属性
  let oldFiber = currentFiber.alternate && currentFiber.alternate.child;
  if (oldFiber)
    oldFiber.firstEffect = oldFiber.nextEffect = oldFiber.lastEffect = null;
  while (newChildrenIndex < newChildren.length) {
    let tag;
    let newFiber; // 新的fiber
    let newChild = newChildren[newChildrenIndex];
    let sameType = oldFiber && newChild && oldFiber.type === newChild.type;
    if (newChild.type === ELEMENT_TEXT) {
      tag = TAG_TEXT; // 这是一个文本节点
    } else if (typeof newChild.type === "string") {
      tag = TAG_HOST; // 如果type是字符串，那么这是一个原生DOM节点
    } else if (
      newChild &&
      typeof newChild.type === "function" &&
      newChild.type.prototype.isReactComponent
    ) {
      tag = TAG_CLASS;
    }
    if (sameType) {
      if (oldFiber.alternate) {
        // 说明至少已经更新过一次
        newFiber = oldFiber.alternate;
        newFiber.props = newChild.props;
        newFiber.alternate = oldFiber;
        newFiber.effectTag = UPDATE;
        newFiber.newEffect = null;
        newFiber.return = currentFiber;
        newFiber.updateQueue = oldFiber.updateQueue || new UpdateQueue();
      } else {
        // 说明新老节点一致，可以复用，做更新操作即可
        newFiber = {
          nextEffect: null, // effect list 也是一个单链表 更新时的单链表
          effectTag: UPDATE,
          tag: oldFiber.tag,
          alternate: oldFiber, // 让新fiber的alternate指向老的fiber节点
          type: oldFiber.type, // div
          return: currentFiber, // 副作用标识 render我们要会收集副作用 增加 删除 更新
          props: newChild.props, // { id="A1", style={style} } 一定要用新的元素的props
          stateNode: oldFiber.stateNode,
          updateQueue: oldFiber.updateQueue || new UpdateQueue(),
        };
      }
    } else {
      if (newChild) {
        // 判断虚拟DOM是否为null
        newFiber = {
          tag,
          stateNode: null, // div还没有创建DOM元素
          nextEffect: null, // effect list 也是一个单链表 更新时的单链表
          type: newChild.type, // div
          return: currentFiber,
          effectTag: PLACEMENT, // 副作用标识 render我们要会收集副作用 增加 删除 更新
          props: newChild.props, // { id="A1", style={style} }
          updateQueue: new UpdateQueue(), // 更新队列
        };
      }
      if (oldFiber) {
        oldFiber.effectTag = DELETION;
        deletions.push(oldFiber);
      }
    }
    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }
    if (newFiber) {
      if (newChildrenIndex === 0) {
        currentFiber.child = newFiber;
      } else {
        prevSibling.sibling = newFiber;
      }
      prevSibling = newFiber;
    }
    newChildrenIndex++;
  }
}

// 循环执行nextUnitOfWork
function workLoop(deadLine) {
  while (
    (deadLine.timeRemaining() > 1 || deadLine.didTimeout) &&
    nextUnitOfWork
  ) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }

  if (!nextUnitOfWork && workInProgressRoot) {
    console.log("render阶段结束");
    commitRoot();
  }

  requestIdleCallback(workLoop, { timeout: 500 });
}

function commitRoot() {
  deletions.forEach(commitWork); // 执行effect list之前先把该删除的元素删除
  let currentFiber = workInProgressRoot.firstEffect;
  while (currentFiber) {
    commitWork(currentFiber);
    currentFiber = currentFiber.nextEffect;
  }
  deletions.length = 0; // 提交之后清空deletions
  currentRoot = workInProgressRoot; // 把当前渲染成功的根Fiber 赋值给currentRoot
  workInProgressRoot = null;
}

function commitWork(currentFiber) {
  if (!currentFiber) return;
  let returnFiber = currentFiber.return;
  while (
    returnFiber.tag !== TAG_HOST &&
    returnFiber.tag !== TAG_ROOT &&
    returnFiber.tag !== TAG_TEXT
  ) {
    returnFiber = returnFiber.return;
  }
  let returnDOM = returnFiber.stateNode;
  if (currentFiber.effectTag === PLACEMENT) {
    // 新增加节点
    let nextFiber = currentFiber;
    // 如果要挂载的节点不是DOM节点，比如说是类组件Fiber，一直找第一个儿子，直到找到一个真实的DOM节点为止
    while (nextFiber.tag !== TAG_HOST && nextFiber.tag !== TAG_TEXT) {
      nextFiber = currentFiber.child;
    }
    returnDOM.appendChild(nextFiber.stateNode);
  } else if (currentFiber.effectTag === DELETION) {
    // 删除节点
    return commitDeletion(currentFiber, returnDOM);
  } else if (currentFiber.effectTag === UPDATE) {
    // 更新节点
    if (currentFiber.type === ELEMENT_TEXT) {
      // 更新文本节点
      if (currentFiber.alternate.props.text !== currentFiber.props.text) {
        currentFiber.stateNode.textContent = currentFiber.props.text;
      }
    } else {
      // if (currentFiber.tag === TAG_CLASS) {
      //   return;
      // }
      updateDOM(
        currentFiber.stateNode,
        currentFiber.alternate.props,
        currentFiber.props
      );
    }
  }
  currentFiber.effectTag = null;
}

function commitDeletion(currentFiber, returnDOM) {
  if (currentFiber.tag === TAG_HOST || currentFiber.tag === TAG_TEXT) {
    returnDOM.removeChild(currentFiber.stateNode);
  } else {
    commitDeletion(currentFiber.child, returnDOM);
  }
}

// 浏览器空闲的时候执行workLoop
// 优先级（hard）expirationTime
requestIdleCallback(workLoop, { timeout: 500 });
