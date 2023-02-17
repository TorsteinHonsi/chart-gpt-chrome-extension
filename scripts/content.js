const evaluateCode = async (elem) => {
  const code = elem.innerText,
    container = getContainer(elem);

  if (container && code !== container.dataset.code) {

    try {
      const tree = esprima.parseScript(code);

      if (tree.body[0].expression.callee.object.name === 'Highcharts') {
        // chart, stockChart, mapChart etc
        const constructor = tree.body[0].expression.callee.property.name,
          // The second argument is the options
          optionsTree = tree.body[0].expression.arguments[1];

        const recurse = expression => {
          if (expression.type === 'ObjectExpression') {
            return expression.properties.reduce((object, property) => {
              if (
                property.value.type === 'ObjectExpression' ||
                property.value.type === 'ArrayExpression'
              ) {
                object[property.key.name] = recurse(property.value);
              } else if (property.value.type === 'Literal') {
                object[property.key.name] = property.value.value;
              }
              return object;
            }, {});

          } else if (expression.type === 'ArrayExpression') {
            return expression.elements.reduce((array, element, i) => {
              if (
                element.type === 'ObjectExpression' ||
                element.type === 'ArrayExpression'
              ) {
                array[i] = recurse(element);
              } else if (element.type === 'Literal') {
                array[i] = element.value;
              }
              return array;
            }, []);
          }
        }

        const options = recurse(optionsTree);

        Highcharts[constructor](container, options);
        onSuccessfulChart(container, elem);
      }
    } catch (e) {
      console.log(e);
    }

    container.dataset.code = code;
  }

}

const onSuccessfulChart = (container, codeElem) => {
  // Constrain the size so we don't get too tall charts
  const parent = codeElem.parentElement;
  parent.style.maxHeight = '400px';
  const height = `calc(${parent.offsetHeight}px + 1rem)`;
  container.style.height = height;

  const pre = codeElem.closest('pre'),
    copyBtn = pre?.querySelector('button');

  const viewBtn = document.createElement('button');
  viewBtn.innerText = 'View code';
  viewBtn.style.position = 'absolute';
  viewBtn.style.right = '8rem';
  viewBtn.onclick = function () {
    if (this.innerText === 'View code') {
      container.style.height = 0;
      this.innerText = 'View chart';
    } else {
      container.style.height = height;
      this.innerText = 'View code';
    }
  }
  copyBtn.parentElement.insertBefore(viewBtn, copyBtn);
}

const getContainer = (codeElem) => {
  const pre = codeElem.closest('pre');

  if (!pre) {
    return;
  }

  let container = pre.querySelector('.container');

  if (!container) {

    pre.style.position = 'relative';
    container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = 0;
    container.style.bottom = 0;
    container.style.transition = 'height 250ms';
    container.className = 'container';

    pre.appendChild(container);
  }

  return container;

}

setInterval(
  async () => {
    const codeElems = document.querySelectorAll('code');
    for (let elem of codeElems) {
      await evaluateCode(elem);
    }
  },
  1000
);
