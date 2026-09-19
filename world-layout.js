function getWorldSize(element, fallbackWidth, fallbackHeight) {
  return {
    width: Math.round(element.clientWidth || fallbackWidth),
    height: Math.round(element.clientHeight || fallbackHeight)
  };
}

if (typeof module !== 'undefined') module.exports = { getWorldSize };
