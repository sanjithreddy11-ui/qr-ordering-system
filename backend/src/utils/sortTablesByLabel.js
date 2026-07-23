// Table labels are free text ("Table 1", "Table 10", "Patio A"...), so a
// plain Mongo/string sort puts "Table 10" before "Table 2". This extracts
// the first number found in the label and sorts by that numerically,
// falling back to a locale-aware string compare (with numeric awareness)
// for labels with no digits at all, so those still sort sensibly instead
// of dropping to the front/back arbitrarily.
function tableNumberFromLabel(label) {
  const match = String(label || "").match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function sortTablesByLabel(tables) {
  return [...tables].sort((a, b) => {
    const numA = tableNumberFromLabel(a.label);
    const numB = tableNumberFromLabel(b.label);

    if (numA !== null && numB !== null && numA !== numB) return numA - numB;
    if (numA !== null && numB === null) return -1;
    if (numA === null && numB !== null) return 1;

    return String(a.label || "").localeCompare(String(b.label || ""), undefined, { numeric: true });
  });
}

module.exports = { tableNumberFromLabel, sortTablesByLabel };
