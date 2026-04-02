function compare(oldAnalysis, newAnalysis) {
  if (!oldAnalysis?.result_json || !newAnalysis?.result_json) return {};

  let oldData, newData;
  try {
    oldData = typeof oldAnalysis.result_json === 'string' ? JSON.parse(oldAnalysis.result_json) : oldAnalysis.result_json;
    newData = typeof newAnalysis.result_json === 'string' ? JSON.parse(newAnalysis.result_json) : newAnalysis.result_json;
  } catch { return {}; }

  const oldRows = oldData.rows || [];
  const newRows = newData.rows || [];
  const oldColumns = (oldData.columns || []).slice(1);
  const newColumns = (newData.columns || []).slice(1);

  const diff = {};

  // Index old rows by field name
  const oldByField = {};
  for (const row of oldRows) {
    oldByField[row.Field] = row;
  }

  for (const newRow of newRows) {
    const field = newRow.Field;
    diff[field] = {};
    const oldRow = oldByField[field];

    for (const col of newColumns) {
      const newVal = newRow[col] || '';
      const oldVal = oldRow ? (oldRow[col] || '') : null;

      if (oldVal === null) {
        diff[field][col] = { status: 'new' };
      } else if (oldVal === newVal) {
        diff[field][col] = { status: 'same' };
      } else {
        diff[field][col] = { status: 'changed', old: oldVal, new: newVal };
      }
    }

    // Check for removed columns
    for (const col of oldColumns) {
      if (!newColumns.includes(col)) {
        diff[field][col] = { status: 'removed' };
      }
    }
  }

  // Check for removed fields
  for (const oldRow of oldRows) {
    const field = oldRow.Field;
    if (!diff[field]) {
      diff[field] = {};
      for (const col of oldColumns) {
        diff[field][col] = { status: 'removed' };
      }
    }
  }

  return diff;
}

module.exports = { compare };
