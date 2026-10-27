class DataRightsError extends Error {
  constructor(status, code, es, en) {
    super(`${es} / ${en}`);
    this.status = status;
    this.code = code;
  }
}

module.exports = DataRightsError;
