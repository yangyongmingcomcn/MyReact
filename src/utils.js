export function setProps(dom, oldProps, newProps) {
  for (let key in oldProps) {
    if (key !== "children") {
      if (newProps.hasOwnProperty(key)) {
        // 在newProps中有oldProps中的属性，key为键名
        setProp(dom, key, newProps[key]); // 新老都有则更新
      } else {
        // 在newProps中没有oldProps中的属性，key为键名
        dom.removeAttribute(key); // 老的oldProps有，新的newProps没有，则删除
      }
    }
  }
  for (let key in newProps) {
    if (key !== "children") {
      if (!oldProps.hasOwnProperty(key)) {
        // 在oldProps中没有newProps中的属性，则添加新增的属性，key为键名
        setProp(dom, key, newProps[key]); // 老的oldProps没有，新的newProps有，则新增
      }
    }
  }
}

function setProp(dom, key, value) {
  if (/^on/.test(key)) {
    dom[key.toLowerCase()] = value;
  } else if (key === "style") {
    if (value) {
      for (let styleName in value) {
        dom.style[styleName] = value[styleName];
      }
    }
  } else {
    dom.setAttribute(key, value);
  }
}
