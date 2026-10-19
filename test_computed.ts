import { Observable } from "./src/utils/observable";
import { ComputedStore } from "./src/utils/computedStore";

const store1 = new Observable(1);
const store2 = new Observable(2);

const computed = new ComputedStore([store1, store2], () => {
    return (store1.getSnapshot() || 0) + (store2.getSnapshot() || 0);
});

console.log("computed snap", computed.getSnapshot());

store1.notify(5);
setTimeout(() => {
    console.log("computed snap after notify 5", computed.getSnapshot());
    store2.notify(10);
    setTimeout(() => {
        console.log("computed snap after notify 10", computed.getSnapshot());
    }, 10);
}, 10);
