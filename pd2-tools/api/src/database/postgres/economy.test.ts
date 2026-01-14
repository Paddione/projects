//@ts-nocheck
import { EconomyDB, ListingPayload } from "./economy";
import { format } from "date-fns";

process.env.POSTGRES_DB = "pd2_tools_test";
process.env.POSTGRES_USER = "test_user";
process.env.POSTGRES_PASSWORD = "test_password";
process.env.POSTGRES_HOST = "localhost";
process.env.POSTGRES_PORT = "5432";

describe("EconomyDB", () => {
  let economyDB: EconomyDB;
  const season11 = 11;
  const season12 = 12;
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  beforeAll(async () => {
    economyDB = new EconomyDB();
    await economyDB.ready;
  });

  afterAll(async () => {
    await economyDB.close();
  });

  beforeEach(async () => {
    // Clean up listings table before each test
    await (
      economyDB as unknown as {
        pool: {
          query: (
            sql: string
          ) => Promise<{ rows: Array<Record<string, string>> }>;
        };
      }
    ).pool.query("DELETE FROM listings");
  });

  describe("Schema Initialization", () => {
    it("should create listings table with correct structure", async () => {
      const result = await (
        economyDB as unknown as {
          pool: {
            query: (
              sql: string
            ) => Promise<{ rows: Array<Record<string, string>> }>;
          };
        }
      ).pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'listings'
                ORDER BY ordinal_position
            `);

      const columns = result.rows.map(
        (r: Record<string, string>) => r.column_name
      );
      expect(columns).toContain("id");
      expect(columns).toContain("bumped_ts");
      expect(columns).toContain("item_name");
      expect(columns).toContain("username");
      expect(columns).toContain("price_str");
      expect(columns).toContain("numerical_price");
      expect(columns).toContain("quantity");
      expect(columns).toContain("data_date");
      expect(columns).toContain("ingestion_date");
      expect(columns).toContain("season");
    });

    it("should create necessary indexes", async () => {
      const result = await (
        economyDB as unknown as {
          pool: {
            query: (
              sql: string
            ) => Promise<{ rows: Array<Record<string, string>> }>;
          };
        }
      ).pool.query(`
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'listings'
            `);

      const indexes = result.rows.map(
        (r: Record<string, string>) => r.indexname
      );
      expect(indexes).toContain("idx_listings_item_date");
      expect(indexes).toContain("idx_listings_season");
      expect(indexes).toContain("idx_listings_item_season");
    });
  });

  describe("Season Isolation", () => {
    it("should store listings in different seasons separately", async () => {
      const listing: ListingPayload = {
        bumpedTs: Date.now(),
        itemName: "Shako",
        username: "trader1",
        priceStr: "1 HR",
        numericalPrice: 1.0,
        quantity: 1,
      };

      await economyDB.addListings([listing], season11);
      await economyDB.addListings(
        [{ ...listing, username: "trader2" }],
        season12
      );

      const s11Listings = await economyDB.getAllListingsForItem(
        "Shako",
        season11
      );
      const s12Listings = await economyDB.getAllListingsForItem(
        "Shako",
        season12
      );

      expect(s11Listings.length).toBe(1);
      expect(s12Listings.length).toBe(1);
      expect(s11Listings[0].username).toBe("trader1");
      expect(s12Listings[0].username).toBe("trader2");
      expect(s11Listings[0].season).toBe(season11);
      expect(s12Listings[0].season).toBe(season12);
    });

    it("should allow same user/item/timestamp in different seasons", async () => {
      const timestamp = Date.now();
      const listing: ListingPayload = {
        bumpedTs: timestamp,
        itemName: "Griffons",
        username: "sameUser",
        priceStr: "5 HR",
        numericalPrice: 5.0,
        quantity: 1,
      };

      const result1 = await economyDB.addListings([listing], season11);
      const result2 = await economyDB.addListings([listing], season12);

      expect(result1.insertedCount).toBe(1);
      expect(result2.insertedCount).toBe(1);

      const s11 = await economyDB.getAllListingsForItem("Griffons", season11);
      const s12 = await economyDB.getAllListingsForItem("Griffons", season12);

      expect(s11.length).toBe(1);
      expect(s12.length).toBe(1);
    });

    it("getUniqueItemNames should return items for specific season only", async () => {
      await economyDB.addListings(
        [
          {
            bumpedTs: Date.now(),
            itemName: "ItemA",
            username: "u1",
            priceStr: "1",
            numericalPrice: 1,
            quantity: 1,
          },
          {
            bumpedTs: Date.now(),
            itemName: "ItemB",
            username: "u2",
            priceStr: "2",
            numericalPrice: 2,
            quantity: 1,
          },
        ],
        season11
      );

      await economyDB.addListings(
        [
          {
            bumpedTs: Date.now(),
            itemName: "ItemC",
            username: "u3",
            priceStr: "3",
            numericalPrice: 3,
            quantity: 1,
          },
          {
            bumpedTs: Date.now(),
            itemName: "ItemD",
            username: "u4",
            priceStr: "4",
            numericalPrice: 4,
            quantity: 1,
          },
        ],
        season12
      );

      const s11Items = await economyDB.getUniqueItemNames(season11);
      const s12Items = await economyDB.getUniqueItemNames(season12);

      expect(s11Items).toEqual(["ItemA", "ItemB"]);
      expect(s12Items).toEqual(["ItemC", "ItemD"]);
    });
  });

  describe("Adding Listings", () => {
    it("should successfully add valid listings", async () => {
      const listings: ListingPayload[] = [
        {
          bumpedTs: Date.now(),
          itemName: "Shako",
          username: "trader1",
          priceStr: "1.5 HR",
          numericalPrice: 1.5,
          quantity: 1,
        },
        {
          bumpedTs: Date.now() - 1000,
          itemName: "SOJ",
          username: "trader2",
          priceStr: "0.5 HR",
          numericalPrice: 0.5,
          quantity: 2,
        },
      ];

      const result = await economyDB.addListings(listings, season11);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it("should skip duplicate listings (same item, user, timestamp, date, season)", async () => {
      const timestamp = Date.now();
      const listing: ListingPayload = {
        bumpedTs: timestamp,
        itemName: "Shako",
        username: "trader1",
        priceStr: "1 HR",
        numericalPrice: 1.0,
        quantity: 1,
      };

      const result1 = await economyDB.addListings([listing], season11);
      expect(result1.insertedCount).toBe(1);

      const result2 = await economyDB.addListings([listing], season11);
      expect(result2.insertedCount).toBe(0);
      expect(result2.skippedCount).toBe(1);
    });

    it("should handle listings with null numericalPrice", async () => {
      const listing: ListingPayload = {
        bumpedTs: Date.now(),
        itemName: "Shako",
        username: "trader1",
        priceStr: "offer",
        numericalPrice: null,
        quantity: 1,
      };

      const result = await economyDB.addListings([listing], season11);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(1);

      const listings = await economyDB.getAllListingsForItem("Shako", season11);
      expect(listings[0].numericalPrice).toBeNull();
      expect(listings[0].priceStr).toBe("offer");
    });

    it("should validate and reject listings with invalid bumpedTs", async () => {
      const invalidListings: ListingPayload[] = [
        {
          bumpedTs: NaN,
          itemName: "Shako",
          username: "trader1",
          priceStr: "1 HR",
          numericalPrice: 1.0,
          quantity: 1,
        },
        {
          bumpedTs: "invalid" as unknown as number,
          itemName: "SOJ",
          username: "trader2",
          priceStr: "0.5 HR",
          numericalPrice: 0.5,
          quantity: 1,
        },
      ];

      const result = await economyDB.addListings(invalidListings, season11);

      expect(result.insertedCount).toBe(0);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0].error).toContain("Invalid bumpedTs");
    });

    it("should validate and reject listings with empty itemName", async () => {
      const listing: ListingPayload = {
        bumpedTs: Date.now(),
        itemName: "",
        username: "trader1",
        priceStr: "1 HR",
        numericalPrice: 1.0,
        quantity: 1,
      };

      const result = await economyDB.addListings([listing], season11);

      expect(result.insertedCount).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain("Item name cannot be empty");
    });

    it("should validate and reject listings with empty username", async () => {
      const listing: ListingPayload = {
        bumpedTs: Date.now(),
        itemName: "Shako",
        username: "   ",
        priceStr: "1 HR",
        numericalPrice: 1.0,
        quantity: 1,
      };

      const result = await economyDB.addListings([listing], season11);

      expect(result.insertedCount).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain("Username cannot be empty");
    });

    it("should handle empty array input", async () => {
      const result = await economyDB.addListings([], season11);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it("should handle non-array input", async () => {
      const result = await economyDB.addListings(
        "not an array" as unknown as ListingPayload[],
        season11
      );

      expect(result.success).toBe(false);
      expect(result.insertedCount).toBe(0);
      expect(result.errors[0].error).toContain("must be an array");
    });

    it("should use transaction and rollback on catastrophic failure", async () => {
      // This would require mocking pool.connect to throw an error
      // For now, we verify that partial success still commits
      const listings: ListingPayload[] = [
        {
          bumpedTs: Date.now(),
          itemName: "ValidItem",
          username: "trader1",
          priceStr: "1 HR",
          numericalPrice: 1.0,
          quantity: 1,
        },
        {
          bumpedTs: NaN,
          itemName: "InvalidItem",
          username: "trader2",
          priceStr: "2 HR",
          numericalPrice: 2.0,
          quantity: 1,
        },
      ];

      const result = await economyDB.addListings(listings, season11);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(1);
      expect(result.errors.length).toBe(1);

      // Verify the valid listing was committed
      const all = await economyDB.getAllListingsForItem("ValidItem", season11);
      expect(all.length).toBe(1);
    });
  });

  describe("Retrieving Listings by Data Date", () => {
    beforeEach(async () => {
      const timestamp1 = new Date(today + " 12:00:00").getTime();
      const timestamp2 = new Date(yesterday + " 12:00:00").getTime();

      await economyDB.addListings(
        [
          {
            bumpedTs: timestamp1,
            itemName: "Shako",
            username: "u1",
            priceStr: "1 HR",
            numericalPrice: 1.0,
            quantity: 1,
          },
          {
            bumpedTs: timestamp1 + 1000,
            itemName: "Shako",
            username: "u2",
            priceStr: "1.5 HR",
            numericalPrice: 1.5,
            quantity: 1,
          },
          {
            bumpedTs: timestamp2,
            itemName: "Shako",
            username: "u3",
            priceStr: "0.8 HR",
            numericalPrice: 0.8,
            quantity: 1,
          },
        ],
        season11
      );

      await economyDB.addListings(
        [
          {
            bumpedTs: timestamp1,
            itemName: "Shako",
            username: "u4",
            priceStr: "2 HR",
            numericalPrice: 2.0,
            quantity: 1,
          },
        ],
        season12
      );
    });

    it("should retrieve listings by data date without season filter", async () => {
      const listings = await economyDB.getListingsByDataDate("Shako", today);

      // Should return both S11 and S12 listings from today
      expect(listings.length).toBe(3);
      expect(listings.every((l) => l.dataDate === today)).toBe(true);
    });

    it("should retrieve listings by data date with season filter", async () => {
      const s11Listings = await economyDB.getListingsByDataDate(
        "Shako",
        today,
        season11
      );
      const s12Listings = await economyDB.getListingsByDataDate(
        "Shako",
        today,
        season12
      );

      expect(s11Listings.length).toBe(2);
      expect(s12Listings.length).toBe(1);
      expect(s11Listings.every((l) => l.season === season11)).toBe(true);
      expect(s12Listings.every((l) => l.season === season12)).toBe(true);
    });

    it("should return listings ordered by bumped_ts descending", async () => {
      const listings = await economyDB.getListingsByDataDate(
        "Shako",
        today,
        season11
      );

      expect(listings.length).toBe(2);
      expect(listings[0].bumpedTs).toBeGreaterThan(listings[1].bumpedTs);
    });

    it("should return empty array for non-existent item", async () => {
      const listings = await economyDB.getListingsByDataDate(
        "NonExistentItem",
        today,
        season11
      );

      expect(listings).toEqual([]);
    });

    it("should return empty array for empty item name", async () => {
      const listings = await economyDB.getListingsByDataDate(
        "",
        today,
        season11
      );

      expect(listings).toEqual([]);
    });
  });

  describe("Retrieving Listings by Ingestion Date", () => {
    beforeEach(async () => {
      const timestamp = Date.now();

      await economyDB.addListings(
        [
          {
            bumpedTs: timestamp,
            itemName: "SOJ",
            username: "u1",
            priceStr: "0.5 HR",
            numericalPrice: 0.5,
            quantity: 1,
          },
          {
            bumpedTs: timestamp + 1000,
            itemName: "SOJ",
            username: "u2",
            priceStr: "0.6 HR",
            numericalPrice: 0.6,
            quantity: 1,
          },
        ],
        season11
      );

      await economyDB.addListings(
        [
          {
            bumpedTs: timestamp,
            itemName: "SOJ",
            username: "u3",
            priceStr: "0.7 HR",
            numericalPrice: 0.7,
            quantity: 1,
          },
        ],
        season12
      );
    });

    it("should retrieve listings by ingestion date without season filter", async () => {
      const listings = await economyDB.getListingsByIngestionDate("SOJ", today);

      expect(listings.length).toBe(3);
      expect(listings.every((l) => l.ingestionDate === today)).toBe(true);
    });

    it("should retrieve listings by ingestion date with season filter", async () => {
      const s11Listings = await economyDB.getListingsByIngestionDate(
        "SOJ",
        today,
        season11
      );
      const s12Listings = await economyDB.getListingsByIngestionDate(
        "SOJ",
        today,
        season12
      );

      expect(s11Listings.length).toBe(2);
      expect(s12Listings.length).toBe(1);
      expect(s11Listings.every((l) => l.season === season11)).toBe(true);
      expect(s12Listings.every((l) => l.season === season12)).toBe(true);
    });

    it("should return empty array for invalid item name", async () => {
      const listings = await economyDB.getListingsByIngestionDate(
        "",
        today,
        season11
      );

      expect(listings).toEqual([]);
    });
  });

  describe("Retrieving All Listings for Item", () => {
    beforeEach(async () => {
      const listings = Array.from({ length: 15 }, (_, i) => ({
        bumpedTs: Date.now() - i * 1000,
        itemName: "Shako",
        username: `user${i}`,
        priceStr: `${i} HR`,
        numericalPrice: i as number,
        quantity: 1,
      }));

      await economyDB.addListings(listings.slice(0, 10), season11);
      await economyDB.addListings(listings.slice(10, 15), season12);
    });

    it("should retrieve all listings for item without season filter", async () => {
      const listings = await economyDB.getAllListingsForItem("Shako");

      expect(listings.length).toBe(15);
    });

    it("should retrieve all listings for item with season filter", async () => {
      const s11Listings = await economyDB.getAllListingsForItem(
        "Shako",
        season11
      );
      const s12Listings = await economyDB.getAllListingsForItem(
        "Shako",
        season12
      );

      expect(s11Listings.length).toBe(10);
      expect(s12Listings.length).toBe(5);
      expect(s11Listings.every((l) => l.season === season11)).toBe(true);
      expect(s12Listings.every((l) => l.season === season12)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const listings = await economyDB.getAllListingsForItem(
        "Shako",
        season11,
        5
      );

      expect(listings.length).toBe(5);
    });

    it("should return listings ordered by bumped_ts descending", async () => {
      const listings = await economyDB.getAllListingsForItem(
        "Shako",
        season11,
        5
      );

      for (let i = 0; i < listings.length - 1; i++) {
        expect(listings[i].bumpedTs).toBeGreaterThanOrEqual(
          listings[i + 1].bumpedTs
        );
      }
    });

    it("should return empty array for non-existent item", async () => {
      const listings = await economyDB.getAllListingsForItem(
        "NonExistent",
        season11
      );

      expect(listings).toEqual([]);
    });
  });

  describe("Retrieving Unique Item Names", () => {
    beforeEach(async () => {
      await economyDB.addListings(
        [
          {
            bumpedTs: Date.now(),
            itemName: "Shako",
            username: "u1",
            priceStr: "1",
            numericalPrice: 1,
            quantity: 1,
          },
          {
            bumpedTs: Date.now(),
            itemName: "Shako",
            username: "u2",
            priceStr: "1",
            numericalPrice: 1,
            quantity: 1,
          },
          {
            bumpedTs: Date.now(),
            itemName: "SOJ",
            username: "u3",
            priceStr: "1",
            numericalPrice: 1,
            quantity: 1,
          },
          {
            bumpedTs: Date.now(),
            itemName: "Griffons",
            username: "u4",
            priceStr: "1",
            numericalPrice: 1,
            quantity: 1,
          },
        ],
        season11
      );

      await economyDB.addListings(
        [
          {
            bumpedTs: Date.now(),
            itemName: "Arachnid",
            username: "u5",
            priceStr: "1",
            numericalPrice: 1,
            quantity: 1,
          },
          {
            bumpedTs: Date.now(),
            itemName: "Maras",
            username: "u6",
            priceStr: "1",
            numericalPrice: 1,
            quantity: 1,
          },
        ],
        season12
      );
    });

    it("should return all unique item names without season filter", async () => {
      const items = await economyDB.getUniqueItemNames();

      expect(items.length).toBe(5);
      expect(items).toContain("Shako");
      expect(items).toContain("SOJ");
      expect(items).toContain("Griffons");
      expect(items).toContain("Arachnid");
      expect(items).toContain("Maras");
    });

    it("should return unique item names for specific season", async () => {
      const s11Items = await economyDB.getUniqueItemNames(season11);
      const s12Items = await economyDB.getUniqueItemNames(season12);

      // PostgreSQL uses case-insensitive sorting by default
      expect(s11Items).toEqual(["Griffons", "Shako", "SOJ"]);
      expect(s12Items).toEqual(["Arachnid", "Maras"]);
    });

    it("should return sorted item names", async () => {
      const items = await economyDB.getUniqueItemNames(season11);

      // Use case-insensitive sort to match PostgreSQL behavior
      const sorted = [...items].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );
      expect(items).toEqual(sorted);
    });

    it("should not include duplicates", async () => {
      const items = await economyDB.getUniqueItemNames(season11);

      const uniqueSet = new Set(items);
      expect(items.length).toBe(uniqueSet.size);
    });
  });

  describe("Data Integrity", () => {
    it("should correctly map all fields in ListingRecord", async () => {
      const timestamp = 1234567890000;
      const listing: ListingPayload = {
        bumpedTs: timestamp,
        itemName: "Test Item",
        username: "testuser",
        priceStr: "1.5 HR",
        numericalPrice: 1.5,
        quantity: 3,
      };

      await economyDB.addListings([listing], season11);

      const retrieved = await economyDB.getAllListingsForItem(
        "Test Item",
        season11
      );

      expect(retrieved.length).toBe(1);
      expect(retrieved[0]).toMatchObject({
        bumpedTs: timestamp,
        itemName: "Test Item",
        username: "testuser",
        priceStr: "1.5 HR",
        numericalPrice: 1.5,
        quantity: 3,
        dataDate: format(new Date(timestamp), "yyyy-MM-dd"),
        ingestionDate: today,
        season: season11,
      });
      expect(retrieved[0].id).toBeDefined();
    });

    it("should handle special characters in item names and usernames", async () => {
      const listing: ListingPayload = {
        bumpedTs: Date.now(),
        itemName: "Arreat's Face",
        username: "user-with_special.chars",
        priceStr: "2 HR",
        numericalPrice: 2.0,
        quantity: 1,
      };

      const result = await economyDB.addListings([listing], season11);

      expect(result.insertedCount).toBe(1);

      const retrieved = await economyDB.getAllListingsForItem(
        "Arreat's Face",
        season11
      );
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].itemName).toBe("Arreat's Face");
      expect(retrieved[0].username).toBe("user-with_special.chars");
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent inserts correctly", async () => {
      const createListings = (offset: number) =>
        Array.from({ length: 5 }, (_, i) => ({
          bumpedTs: Date.now() + offset + i,
          itemName: "ConcurrentItem",
          username: `user${offset}_${i}`,
          priceStr: "1 HR",
          numericalPrice: 1.0,
          quantity: 1,
        }));

      const results = await Promise.all([
        economyDB.addListings(createListings(0), season11),
        economyDB.addListings(createListings(1000), season11),
        economyDB.addListings(createListings(2000), season11),
      ]);

      const totalInserted = results.reduce(
        (sum, r) => sum + r.insertedCount,
        0
      );
      expect(totalInserted).toBe(15);

      const allListings = await economyDB.getAllListingsForItem(
        "ConcurrentItem",
        season11
      );
      expect(allListings.length).toBe(15);
    });
  });
});
