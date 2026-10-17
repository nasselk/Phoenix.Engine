import { Thread } from "../../shared/utils/thread";
import type { Messages } from "./thread.test";

const parent = Thread.parent<Messages>();

parent.onRequest("double", (value) => value * 2);
parent.on("echo", (text) => parent.send("echo", text));
