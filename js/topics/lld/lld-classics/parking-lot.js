// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const CLASS_SVG = `<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Parking lot class model">
  <defs><marker id="fig-parking-lot-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <rect x="20" y="80" width="130" height="60" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="85" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">ParkingLot</text>
  <text x="85" y="118" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">levels, entry()</text>
  <rect x="230" y="80" width="130" height="60" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="295" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Level</text>
  <text x="295" y="118" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">free spots by size</text>
  <rect x="440" y="20" width="150" height="56" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="515" y="42" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Spot</text>
  <text x="515" y="60" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">size, occupiedBy</text>
  <rect x="440" y="130" width="150" height="56" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="515" y="152" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ticket</text>
  <text x="515" y="170" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">spot, entryTime, fee()</text>
  <line x1="150" y1="110" x2="228" y2="110" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-parking-lot-arr)"/>
  <line x1="360" y1="100" x2="438" y2="60" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-parking-lot-arr)"/>
  <line x1="360" y1="120" x2="438" y2="150" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-parking-lot-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "parking-lot",
  title: "Parking Lot",
  category: "lld-classics",
  track: "lld",
  tier: "essential",
  archetype: "classic",
  oneliner: `Model levels, spots of different sizes, and tickets — then answer "where does this vehicle fit and what does it owe?" in O(1).`,
  figures: [
    { id: "parking-classes", svg: CLASS_SVG, caption: "Core objects: a ParkingLot owns Levels, each Level tracks Spots by size, and a Ticket links a Spot to entry time for fee calculation." },
  ],
  sections: [
    { title: `Requirements and scope`, body: `<p>The interview version asks for a multi-level lot that parks several <b>vehicle types</b> (motorcycle, car, truck/van) into <b>spot sizes</b> (small, compact, large), issues a <b>ticket</b> on entry, and charges a <b>fee</b> on exit based on duration. Clarify the rules up front: can a car use a large spot when compacts are full? (usually yes — a vehicle fits any spot its size or larger); is pricing per hour, tiered, or flat? is the lot concurrent (many gates)? These answers decide the data structures, so pin them before drawing classes.</p>` },
    { title: `The class model`, figureAfter: "parking-classes", body: `<p>Keep responsibilities narrow: the lot routes, a level tracks availability, a spot holds one vehicle, and a ticket owns pricing state.</p>
<pre>public enum VehicleType { MOTORCYCLE, CAR, TRUCK }

public enum SpotSize { SMALL, COMPACT, LARGE }

public final class Vehicle {
    private final String licensePlate;
    private final VehicleType type;

    public Vehicle(String licensePlate, VehicleType type) {
        this.licensePlate = licensePlate;
        this.type = type;
    }

    public String licensePlate() { return licensePlate; }
    public VehicleType type() { return type; }

    public boolean fitsIn(SpotSize spotSize) {
        return switch (type) {
            case MOTORCYCLE -&gt; true;
            case CAR        -&gt; spotSize != SpotSize.SMALL;
            case TRUCK      -&gt; spotSize == SpotSize.LARGE;
        };
    }
}</pre>
<pre>public final class Spot {
    private final String id;
    private final SpotSize size;
    private Vehicle occupiedBy;

    public Spot(String id, SpotSize size) {
        this.id = id;
        this.size = size;
    }

    public boolean isFree() { return occupiedBy == null; }

    public boolean canFit(Vehicle vehicle) {
        return isFree() &amp;&amp; vehicle.fitsIn(size);
    }

    public synchronized void park(Vehicle vehicle) {
        if (!canFit(vehicle)) throw new IllegalStateException("Spot " + id + " cannot fit vehicle");
        this.occupiedBy = vehicle;
    }

    public synchronized void vacate() { this.occupiedBy = null; }

    public String id() { return id; }
    public SpotSize size() { return size; }
}</pre>` },
    { title: `Data structures for O(1) assignment`, body: `<p>Each <b>Level keeps a free-list per spot size</b> — a deque of currently-empty spots keyed by <code>SpotSize</code>:</p>
<pre>public final class Level {
    private final int floor;
    private final Map&lt;SpotSize, Deque&lt;Spot&gt;&gt; freeSpots = new EnumMap&lt;&gt;(SpotSize.class);

    public Level(int floor, List&lt;Spot&gt; spots) {
        this.floor = floor;
        for (SpotSize size : SpotSize.values()) {
            freeSpots.put(size, new ArrayDeque&lt;&gt;());
        }
        for (Spot spot : spots) {
            freeSpots.get(spot.size()).addLast(spot);
        }
    }

    public synchronized Optional&lt;Spot&gt; assignSpot(Vehicle vehicle) {
        List&lt;SpotSize&gt; candidates = switch (vehicle.type()) {
            case MOTORCYCLE -&gt; List.of(SpotSize.SMALL, SpotSize.COMPACT, SpotSize.LARGE);
            case CAR        -&gt; List.of(SpotSize.COMPACT, SpotSize.LARGE);
            case TRUCK      -&gt; List.of(SpotSize.LARGE);
        };
        for (SpotSize size : candidates) {
            Spot spot = freeSpots.get(size).pollFirst();
            if (spot != null) {
                spot.park(vehicle);
                return Optional.of(spot);
            }
        }
        return Optional.empty();
    }

    public synchronized void releaseSpot(Spot spot) {
        spot.vacate();
        freeSpots.get(spot.size()).addLast(spot);
    }
}</pre>
<p>Parking and unparking become O(1) pushes/pops, and a per-size counter answers "is the lot full for trucks?" instantly.</p>` },
    { title: `ParkingLot, tickets, and pricing`, body: `<p>The lot coordinates levels, issues tickets, and delegates fee calculation to a strategy:</p>
<pre>public final class Ticket {
    private final String id;
    private final Spot spot;
    private final Vehicle vehicle;
    private final Instant entryTime;

    public Ticket(String id, Spot spot, Vehicle vehicle, Instant entryTime) {
        this.id = id;
        this.spot = spot;
        this.vehicle = vehicle;
        this.entryTime = entryTime;
    }

    public String id() { return id; }
    public Spot spot() { return spot; }
    public Instant entryTime() { return entryTime; }
}

public interface PricingStrategy {
    long feeCents(Instant entry, Instant exit);
}

public final class HourlyPricing implements PricingStrategy {
    private final long centsPerHour;

    @Override
    public long feeCents(Instant entry, Instant exit) {
        long minutes = Duration.between(entry, exit).toMinutes();
        long hours = (minutes + 59) / 60;
        return hours * centsPerHour;
    }
}

public final class ParkingLot {
    private final List&lt;Level&gt; levels;
    private final PricingStrategy pricing;
    private final Map&lt;String, Ticket&gt; activeTickets = new ConcurrentHashMap&lt;&gt;();

    public ParkingLot(List&lt;Level&gt; levels, PricingStrategy pricing) {
        this.levels = levels;
        this.pricing = pricing;
    }

    public Ticket parkVehicle(Vehicle vehicle) {
        for (Level level : levels) {
            Optional&lt;Spot&gt; spot = level.assignSpot(vehicle);
            if (spot.isPresent()) {
                Ticket ticket = new Ticket(
                    UUID.randomUUID().toString(), spot.get(), vehicle, Instant.now());
                activeTickets.put(ticket.id(), ticket);
                return ticket;
            }
        }
        throw new ParkingFullException("No spot available for " + vehicle.type());
    }

    public long unpark(Ticket ticket) {
        Ticket active = activeTickets.remove(ticket.id());
        levels.forEach(level -&gt; level.releaseSpot(active.spot()));
        return pricing.feeCents(active.entryTime(), Instant.now());
    }
}</pre>
<p>With multiple entry gates, guard the free-list per level with synchronization so the pop-and-mark is atomic. For a payments-flavoured extension, <code>unpark</code> returns an amount that the gate hands to the same charge flow used elsewhere — the parking domain stays clean and the money movement is someone else's concern.</p>` },
  ],
  related: ["elevator", "strategy", "single-responsibility-principle"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("parking-lot", stage, panel, stageEl);
}
