import { Observable } from "./src/utils/observable";
import { ComputedStore } from "./src/utils/computedStore";

const store1 = new Observable(1);
const store2 = new Observable(2);

const computed = new ComputedStore([store1, store2], () => {
    return (store1.getSnapshot() || 0) + (store2.getSnapshot() || 0);
});

console.log("computed snap", computed.getSnapshot());

store1.notify(5);

// since notify batches, the subscriber isn't called synchronously
// so the computed store doesn't get dirty.
// but store1.getSnapshot() should return the updated state immediately.
console.log("computed snap after notify 5", computed.getSnapshot());

// Wait
setTimeout(() => {
    console.log("computed snap after notify 5 in microtask", computed.getSnapshot());
}, 0);
