
const evaluateCode = (elem) => {
  let code = elem.innerText;

  const container = getContainer(elem);

  // const regex = /Highcharts\.chart\('container', ([<>{}\/\n a-zA-Z:0-9',\.\[\]#\$%\-]+)\);/;
  const regex = /Highcharts\.chart\('container', ([\s\S]+)\);/;

  const match = code.match(regex);

  if (container && match) {
    const sOptions = match[1];
    if (sOptions !== container.dataset.sOptions) {
      const options = JSON5.parse(sOptions);
      Highcharts.chart(container, options);
      container.dataset.sOptions = sOptions;

      onSuccessfulChart(container, elem);
    }
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
  () => {
    [...document.querySelectorAll('code')].forEach(elem => evaluateCode(elem))
  },
  1000
);
