import { Container, SimpleGrid, Skeleton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import PlayerTable from "../components/builds/CharacterTable";
import ClassCard from "../components/builds/ClassCard";
import UniqueCard from "../components/builds/UniqueCard";
import ClassBar from "../components/builds/ClassBar";
import SkillCard from "../components/builds/SkillCard";
import MercTypeCard from "../components/builds/MercTypeCard";
import MercItemCard from "../components/builds/MercItemCard";
import { Helmet } from "react-helmet";
import { useCharacterFilters, useCharacterData } from "../hooks";

export default function Builds() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { filters, updateFilters } = useCharacterFilters();
  const { data, isLoading } = useCharacterData(filters);

  return (
    <>
      <Helmet>
        <title>Builds - pd2.tools</title>
        <meta
          name="description"
          content="Explore the top 1000 Softcore and Hardcore characters to find new builds and analyze the meta"
        />
      </Helmet>

      <Container my="md" size="xl" style={{ marginBottom: "5%" }}>
        <SimpleGrid cols={1} spacing="md">
          {isLoading ? (
            <Skeleton height="75px" />
          ) : data ? (
            <ClassBar
              data={data}
              filters={filters}
              updateFilters={updateFilters}
            />
          ) : (
            <Skeleton height="75px" />
          )}

          {isMobile ? (
            <SimpleGrid cols={1} spacing="md">
              <div>
                <SimpleGrid cols={1} spacing="md">
                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <ClassCard
                      breakdown={data.breakdown}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}

                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <UniqueCard
                      data={data}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}

                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <SkillCard
                      data={data}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}

                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <MercTypeCard
                      data={data}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}

                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <MercItemCard
                      data={data}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}
                </SimpleGrid>
              </div>

              <div>
                {isLoading ? (
                  <Skeleton height="1800px" />
                ) : data ? (
                  <PlayerTable
                    filters={filters}
                    characters={data.characters}
                    total={data.total}
                  />
                ) : (
                  <Skeleton height="612px" />
                )}
              </div>
            </SimpleGrid>
          ) : (
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ width: "185px" }}>
                <SimpleGrid cols={1} spacing="md">
                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <ClassCard
                      breakdown={data.breakdown}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}

                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <UniqueCard
                      data={data}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}

                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <SkillCard
                      data={data}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}

                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <MercTypeCard
                      data={data}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}

                  {isLoading ? (
                    <Skeleton height="300px" />
                  ) : data ? (
                    <MercItemCard
                      data={data}
                      filters={filters}
                      updateFilters={updateFilters}
                    />
                  ) : (
                    <Skeleton height="300px" />
                  )}
                </SimpleGrid>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: "auto",
                  height: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {isLoading ? (
                  <Skeleton height="1800px" />
                ) : data ? (
                  <PlayerTable
                    filters={filters}
                    characters={data.characters}
                    total={data.total}
                  />
                ) : (
                  <Skeleton height="612px" />
                )}
              </div>
            </div>
          )}
        </SimpleGrid>
      </Container>
    </>
  );
}
