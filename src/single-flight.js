// v160: a background check never runs twice at the same time in this server.
// If it is called while it is still running (a slow server where the next
// timer fires before the last run finished, or the same check started from
// two places), the second call waits for the run in progress and shares its
// result instead of starting another. Without this, two overlapping runs
// could both send the same job to the same pro, or the same reminder twice.
function singleFlight(fn) {
  let running = null;
  const wrapped = function () {
    if (running) return running;
    running = Promise.resolve().then(() => fn.apply(this, arguments)).finally(() => { running = null; });
    return running;
  };
  return wrapped;
}
// The same, by name: used by server.js for every timed check, so a run that is
// slow (a payment provider taking long to answer) never overlaps the next one.
const running = new Map();
function onceAtATime(name, start) {
  if (running.has(name)) return running.get(name);
  const p = Promise.resolve().then(start).finally(() => running.delete(name));
  running.set(name, p);
  return p;
}
module.exports = { singleFlight, onceAtATime };
