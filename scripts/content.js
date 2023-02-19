const evaluateCode = async (elem) => {

  let code = elem.innerText;

  // Only options object given by ChatGPT
  if (/^{[\s]+chart: {/.test(code)) {
    code = `Highcharts.chart('container', ${code})`;
  }

  const container = getContainer(elem),
    hasHighcharts = /Highcharts/i.test(code);

  if (hasHighcharts && container && code !== container.dataset.code) {
    const island = createInfoIsland(elem),
      log = [];

    let tree;

    try {
      tree = esprima.parseScript(code);
    } catch (e) {
      log.push(`Could not parse the code. ${e.description}`);
    }

    try {
      if (tree && tree.body[0].expression.callee.object.name === 'Highcharts') {
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

        await loadMap(options);

        Highcharts[constructor](container, options);
        onSuccessfulChart(container, elem);
      }
    } catch (e) {
      log.push(e);
    }

    console.log('log', log)

    container.dataset.code = code;
  }
}

const loadMap = async (options) => {
  const map = options.chart?.map;
  if (typeof map === 'string' && /^[a-z\-\/]+$/.test(map)) {
    try {
      const url = `https://code.highcharts.com/mapdata/${map}.topo.json`;
      const topology = await fetch(url).then(response => response.json());
      if (topology) {
        options.chart.map = topology;
      }
    } catch {
      console.log('@loadMap', `could not load ${url}`);
    }
  }
}

const createInfoIsland = (codeElem) => {
  const pre = codeElem.closest('pre'),
    copyBtn = pre?.querySelector('button');
  let island = pre?.querySelector('.info-island');

  if (pre && !island) {
    island = document.createElement('div');
    island.className = 'info-island';
    island.style.position = 'absolute';
    island.style.right = '8rem';
    island.style.border = '1px solid gray';
    island.style.padding = '0 1rem';
    island.style.borderRadius = '0.6rem'
    // const url = chrome.runtime.getURL('images/icon.png');
    // island.style.backgroundImage = `url("${url}")`;

    copyBtn.parentElement.insertBefore(island, copyBtn);
  }
  return island;
}

const onSuccessfulChart = (container, codeElem) => {
  // Constrain the size so we don't get too tall charts
  const parent = codeElem.parentElement;
  parent.style.maxHeight = '400px';
  const height = `calc(${parent.offsetHeight}px + 1rem)`;
  container.style.height = height;

  const pre = codeElem.closest('pre');

  const viewBtn = document.createElement('button');
  viewBtn.innerText = 'View code';
  viewBtn.onclick = function () {
    if (this.innerText === 'View code') {
      container.style.height = 0;
      this.innerText = 'View chart';
    } else {
      container.style.height = height;
      this.innerText = 'View code';
    }
  }
  pre.querySelector('.info-island').appendChild(viewBtn);
}

// Override some ChatGPT styles
document.styleSheets[0].insertRule(
  `.markdown .highcharts-container ul li:before {
    content: "";
    font-size: inherit;
    line-height: inherit;
    margin-left: 0;
    position: static;
  }`
);
document.styleSheets[0].insertRule(
  `.highcharts-menu hr {
    margin: 0;
  }`
);

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
    container.style.fontFamily = 'Arial, sans-serif';
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
