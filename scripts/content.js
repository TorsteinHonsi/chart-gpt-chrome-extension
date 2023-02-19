const evaluateCode = async (elem) => {

  let code = elem.innerText;

  // Only options object given by ChatGPT
  if (/^{[\s]+chart: {/.test(code)) {
    code = `Highcharts.chart('container', ${code})`;

  // Full HTML page given by ChatGPT
  } else if (/<script>/.test(code)) {
    code = code.replace(
      /^[\s\S]+<script>([\s\S]+)<\/script>[\s\S]+$/,
      '$1'
    );
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
      if (e.description === 'Unexpected end of input') {
        log.push(`Could not parse the code (${e.description}). This usually \
        means either that the response is still loading incrementally, or that \
        the response was aborted. Try asking again, or "Regenerate response".`);
      }
    }

    try {
      if (tree && tree.body[0].expression.callee?.object.name === 'Highcharts') {
        // chart, stockChart, mapChart etc
        const constructor = tree.body[0].expression.callee.property.name,
          // The second argument is the options
          optionsTree = tree.body[0].expression.arguments[1];

        const handleChild = (owner, child, key) => {
          if (
            child.type === 'ObjectExpression' ||
            child.type === 'ArrayExpression'
          ) {
            owner[key] = recurse(child);

          // Strings, numbers etc
          } else if (child.type === 'Literal') {
            owner[key] = child.value;

          // Date.UTC calls are pretty common in Highcharts configs
          } else if (
            child.type === 'CallExpression' &&
            child.callee.object.name === 'Date' &&
            child.callee.property.name === 'UTC'
          ) {
            owner[key] = Date.UTC.apply(
              Date,
              child.arguments.map(arg => arg.value)
            );

          // Formatters and event callbacks
          } else if (child.type === 'FunctionExpression') {
            log.push(`Detected function expression for "${key}". Because of \
              Google Extensions security policies, this cannot be recreated in \
              the preview, and is left out.`);

          } else {
            console.log('Unknown child type', child);
          }
        }

        const recurse = expression => {
          if (expression.type === 'ObjectExpression') {
            return expression.properties.reduce((object, property) => {
              handleChild(object, property.value, property.key.name);
              return object;
            }, {});

          } else if (expression.type === 'ArrayExpression') {
            return expression.elements.reduce((array, element, i) => {
              handleChild(array, element, i);
              return array;
            }, []);
          }
        }

        const options = recurse(optionsTree);

        await loadMap(options);

        Highcharts[constructor](container, options);
        onSuccessfulChart(container, elem);
      } else if (tree) {
        log.push('We detected Highcharts on this page, but were unable to \
          create a preview. Probably the suggested code is too complex. Try \
          asking ChatGPT in a different way. Try starting your request by \
          "Create a Highcharts configuration for ...".');
      }
    } catch (e) {
      log.push(e);
    }

    createLog(island, log);

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

const createLog = (island, log) => {
  let btn = island.querySelector('.log-btn');

  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'log-btn';
    // Insert before the view code button
    island.insertBefore(btn, island.querySelector('button'));
  }
  btn.innerText = `Log (${log.length})`;
  btn.style.display = log.length ? '' : 'none';

  btn.onclick = () => alert('• ' + log.join('\n\n• ').replace(/[ ]+/g, ' '));

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
    island.style.padding = '0.2rem 0.7rem 0 1rem';
    island.style.borderRadius = '0.75rem'
    island.style.height = '1.5rem';
    const url = chrome.runtime.getURL('images/icon.png');
    island.style.backgroundImage = `url("${url}")`;
    island.style.backgroundSize = '1rem 1rem';
    island.style.backgroundPosition = '0.4rem 0.2rem';
    island.style.backgroundRepeat = 'no-repeat';

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
      container.style.left = '100%';
      this.innerText = 'View chart';
    } else {
      container.style.left = 0;
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
document.styleSheets[0].insertRule(
  `.info-island button {
    margin-left: 1rem;
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
    pre.style.overflowX = 'clip';

    container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = 0;
    container.style.top = '2rem';
    container.style.transition = 'left 250ms';
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
