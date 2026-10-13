import pool from "../config/db";
import {
  getMyDeliveryAssignments,
} from "../services/dildhara-reliefDispatchService";

const query = jest.mocked(pool.query);

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [], rowCount: 0 } as never);
});

describe("authenticated delivery assignment retrieval", () => {
  it("filters individual trips by their volunteer profile or assigned driver user", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";

    await getMyDeliveryAssignments(userId, "DELIVERY_VOLUNTEER");

    const [sql, parameters] = query.mock.calls[0];
    expect(String(sql)).toContain(
      "(volunteer.user_id = $1 OR assignment.driver_user_id = $1)"
    );
    expect(parameters).toEqual([userId]);
    expect(String(sql)).toContain("WHERE item.assignment_id = assignment.id");
    expect(String(sql)).toContain("allocation.destination_location");
  });

  it("filters team trips through the team profile's owning account", async () => {
    const userId = "22222222-2222-4222-8222-222222222222";

    await getMyDeliveryAssignments(userId, "DELIVERY_VOLUNTEER_TEAM");

    const [sql, parameters] = query.mock.calls[0];
    expect(String(sql)).toContain("WHERE team.user_id = $1");
    expect(parameters).toEqual([userId]);
  });

  it("rejects all other roles before querying assignment data", async () => {
    await expect(
      getMyDeliveryAssignments(
        "33333333-3333-4333-8333-333333333333",
        "CITIZEN"
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(query).not.toHaveBeenCalled();
  });
});
