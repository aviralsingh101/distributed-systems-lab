// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const STATE_SVG = `<svg viewBox="0 0 560 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Elevator direction state machine">
  <defs><marker id="fig-elevator-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <ellipse cx="280" cy="85" rx="70" ry="34" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/>
  <text x="280" y="89" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">IDLE</text>
  <ellipse cx="90" cy="85" rx="70" ry="34" fill="#1a2236" stroke="#3ddc97" stroke-width="1.6"/>
  <text x="90" y="82" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">MOVING_UP</text>
  <text x="90" y="98" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">serve up-set</text>
  <ellipse cx="470" cy="85" rx="70" ry="34" fill="#1a2236" stroke="#ff8fab" stroke-width="1.6"/>
  <text x="470" y="82" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">MOVING_DOWN</text>
  <text x="470" y="98" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">serve down-set</text>
  <line x1="212" y1="75" x2="160" y2="80" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-elevator-arr)"/>
  <line x1="160" y1="98" x2="212" y2="95" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-elevator-arr)"/>
  <line x1="348" y1="95" x2="400" y2="98" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-elevator-arr)"/>
  <line x1="400" y1="80" x2="348" y2="75" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-elevator-arr)"/>
  <text x="280" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">keep current direction until its request set empties (SCAN / LOOK)</text>
</svg>`;

const topic = makeTopic({
  id: "elevator",
  title: "Elevator",
  category: "lld-classics",
  track: "lld",
  tier: "essential",
  archetype: "classic",
  oneliner: `Model cars, floor requests, and a scheduler that sweeps in one direction (SCAN/LOOK) instead of naively serving requests first-come-first-served.`,
  figures: [
    { id: "elevator-states", svg: STATE_SVG, caption: "Each car is a small state machine: it commits to a direction and services every request in that direction before reversing." },
  ],
  sections: [
    { title: `Requirements and the two request types`, body: `<p>Design a controller for one or more elevator cars in an N-floor building. The subtlety most candidates miss is that there are <b>two kinds of request</b>: <b>hall calls</b> (a person on floor 7 presses "up") which carry a <em>direction</em>, and <b>car calls</b> (a rider inside presses "3") which carry only a <em>target floor</em>. A good design treats them differently, because a hall call for "up" should be served by a car already travelling up, not one heading down.</p>` },
    { title: `The scheduling algorithm`, body: `<p>Serving requests first-come-first-served makes the car yo-yo and starves riders. The standard answer is the <b>elevator algorithm (SCAN / LOOK)</b>, the same idea as a disk-head scheduler: keep moving in the current direction, stopping at every requested floor along the way, and only reverse when there are no more requests ahead in that direction.</p>
<p>Implement it with two sorted sets per car: an <code>upSet</code> (floors to visit while going up) and a <code>downSet</code>. While <code>MOVING_UP</code>, pop the next floor above current from <code>upSet</code>; when it empties, switch to <code>MOVING_DOWN</code> and drain <code>downSet</code>. A new request is inserted into the set matching its direction relative to the car's position, so it is picked up naturally on the current or return sweep.</p>` },
    { title: `The class model`, figureAfter: "elevator-states", body: `<p>Separate the mechanical car from the dispatch policy so the scheduling strategy is swappable:</p>
<pre>public enum Direction { UP, DOWN, IDLE }

public final class ElevatorRequest {
    private final int floor;
    private final Direction hallDirection;  // null for in-car button presses

    public ElevatorRequest(int floor, Direction hallDirection) {
        this.floor = floor;
        this.hallDirection = hallDirection;
    }

    public int floor() { return floor; }
    public Optional&lt;Direction&gt; hallDirection() {
        return Optional.ofNullable(hallDirection);
    }
    public boolean isHallCall() { return hallDirection != null; }
}</pre>
<pre>public final class ElevatorCar {
    private int currentFloor;
    private Direction direction = Direction.IDLE;
    private final TreeSet&lt;Integer&gt; upTargets = new TreeSet&lt;&gt;();
    private final TreeSet&lt;Integer&gt; downTargets = new TreeSet&lt;&gt;(Collections.reverseOrder());

    public void addRequest(ElevatorRequest request) {
        int floor = request.floor();
        if (request.isHallCall()) {
            if (request.hallDirection().get() == Direction.UP) upTargets.add(floor);
            else downTargets.add(floor);
        } else {
            if (floor &gt; currentFloor) upTargets.add(floor);
            else if (floor &lt; currentFloor) downTargets.add(floor);
            else openDoors();
        }
        if (direction == Direction.IDLE) {
            direction = floor &gt;= currentFloor ? Direction.UP : Direction.DOWN;
        }
    }

    public void step() {
        if (direction == Direction.UP) {
            if (upTargets.isEmpty()) {
                direction = downTargets.isEmpty() ? Direction.IDLE : Direction.DOWN;
            } else {
                int next = upTargets.higher(currentFloor);
                if (next == -1) { direction = Direction.DOWN; return; }
                moveTo(next);
            }
        } else if (direction == Direction.DOWN) {
            if (downTargets.isEmpty()) {
                direction = upTargets.isEmpty() ? Direction.IDLE : Direction.UP;
            } else {
                int next = downTargets.lower(currentFloor);
                if (next == -1) { direction = Direction.UP; return; }
                moveTo(next);
            }
        }
    }

    private void moveTo(int floor) {
        currentFloor = floor;
        upTargets.remove(floor);
        downTargets.remove(floor);
        openDoors();
    }

    private void openDoors() { /* unload/load passengers */ }

    public int currentFloor() { return currentFloor; }
    public Direction direction() { return direction; }
}</pre>` },
    { title: `Dispatcher and edge cases`, body: `<p>The <b>dispatcher</b> for a multi-car bank assigns hall calls to the car that is closest and already moving toward it:</p>
<pre>public final class ElevatorSystem {
    private final List&lt;ElevatorCar&gt; cars;

    public ElevatorSystem(int carCount) {
        this.cars = IntStream.range(0, carCount)
            .mapToObj(i -&gt; new ElevatorCar())
            .toList();
    }

    public void requestHall(int floor, Direction direction) {
        ElevatorCar best = cars.stream()
            .min(Comparator.comparingInt(c -&gt; cost(c, floor, direction)))
            .orElseThrow();
        best.addRequest(new ElevatorRequest(floor, direction));
    }

    public void requestCar(int carIndex, int floor) {
        cars.get(carIndex).addRequest(new ElevatorRequest(floor, null));
    }

    public void tick() {
        cars.forEach(ElevatorCar::step);
    }

    private int cost(ElevatorCar car, int floor, Direction dir) {
        int distance = Math.abs(car.currentFloor() - floor);
        if (car.direction() == Direction.IDLE) return distance;
        if (car.direction() == dir) return distance;
        return distance + 100;  // penalty for wrong-direction car
    }
}</pre>
<p>Handle the details interviewers probe: an idle car should adopt the direction of the first new request; requests for the current floor open the doors immediately; capacity/weight limits let a full car skip hall calls; and door-open, door-close, and emergency-stop are extra states on the car's machine. Keep the car's motion logic, the request-set bookkeeping, and the dispatch policy in separate objects so each can be tested and tuned on its own.</p>` },
  ],
  related: ["parking-lot", "state", "strategy"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("elevator", stage, panel, stageEl);
}
