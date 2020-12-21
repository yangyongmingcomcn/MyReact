import React from "./react";
import ReactDOM from "./react-dom";

class ClassCounter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { number: 0, data: "YYM" };
  }

  onAdd = () => {
    this.setState((state) => ({ number: state.number + 1 }));
  };

  onSubtract = () => {
    const { number } = this.state;
    if (number) {
      this.setState((state) => ({ number: state.number - 1 }));
    }
  };

  handleChange = (e) => {
    this.setState({
      data: e.target.value,
    });
  };

  render() {
    const { data } = this.state;
    return (
      <div>
        <div id="counter">
          <span style={{ marginRight: "1%" }}>{this.state.number}</span>
          <button style={{ marginRight: "1%" }} onClick={this.onAdd}>
            加1
          </button>
          <button onClick={this.onSubtract}>减1</button>
        </div>
        <div>
          <input value={data} onChange={this.handleChange}></input>
          <p>{data}</p>
        </div>
      </div>
    );
  }
}

ReactDOM.render(
  <ClassCounter name="计数器" />,
  document.getElementById("root")
);
