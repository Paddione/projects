import { Card, SegmentedControl, Text, Tooltip } from "@mantine/core";
import { groupBy } from "lodash";
import skillCategories from "./map";
import type { SkillsSectionProps } from "../../types";

export function SkillsSection({
  skills,
  hasCta,
  skillsView,
  onSkillsViewChange,
}: SkillsSectionProps) {
  return (
    <Card h="520px" radius="md" shadow="md" style={{ overflow: "hidden" }}>
      <Card.Section style={{ marginBottom: "5px" }}>
        <Card
          radius="0"
          style={{
            backgroundColor: "rgb(44, 45, 50)",
            borderBottomColor: "rgb(55, 58, 64)",
            borderBottomWidth: "1.75px",
            borderBottomStyle: "solid",
          }}
        >
          <Card.Section>
            <Text
              fw={500}
              style={{
                marginLeft: "10px",
                marginTop: "4.15px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Skills</span>
              <div style={{ marginRight: "8px", marginTop: "2px" }}>
                <SegmentedControl
                  value={skillsView}
                  size="xs"
                  onChange={onSkillsViewChange}
                  withItemsBorders={false}
                  styles={{
                    root: {
                      minHeight: "unset",
                      position: "relative",
                      top: "-2px",
                      marginLeft: 8,
                    },
                    label: {
                      fontSize: "12px",
                      lineHeight: "14px",
                    },
                  }}
                  data={[{ label: "Text", value: "text" }]}
                />
              </div>
            </Text>
          </Card.Section>
        </Card>
      </Card.Section>

      {skillsView === "text" ? (
        <div
          style={{
            padding: "8px 2px 0 4px",
            maxHeight: 410,
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "thin",
            scrollbarColor: "#444 #222",
          }}
        >
          {Object.entries(
            groupBy(skills, (skill) => skillCategories.get(skill.skill))
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, categorySkills]) => (
              <div key={category} style={{ marginBottom: "14px" }}>
                <Text
                  fw={600}
                  size="sm"
                  style={{
                    marginBottom: "2px",
                    color: "#e0e0e0",
                    letterSpacing: 0.2,
                    paddingLeft: 2,
                    fontSize: "13px",
                    textTransform: "uppercase",
                  }}
                >
                  {category}
                </Text>
                <div
                  style={{
                    borderRadius: "7px",
                    padding: "7px 10px 7px 10px",
                  }}
                >
                  {categorySkills.map((skill, idx) => (
                    <Text
                      size="sm"
                      key={skill.skill}
                      style={{
                        marginBottom:
                          idx < categorySkills.length - 1 ? "2px" : 0,
                        color: "#f3f3f3",
                        fontSize: "13px",
                        paddingLeft: 2,
                      }}
                    >
                      <span style={{ color: "#C1C2C5" }}>{skill.skill}</span>:{" "}
                      <Tooltip label="Base level">
                        <span style={{ color: "#fff" }}>{skill.baseLevel}</span>
                      </Tooltip>{" "}
                      /{" "}
                      <Tooltip label="Level including +skills">
                        <span style={{ color: "#eef211" }}>{skill.level}</span>
                      </Tooltip>
                      {hasCta && (
                        <>
                          {" "}
                          /{" "}
                          <Tooltip label="Level including CTA">
                            <span style={{ color: "#0de03b" }}>
                              {skill.level + 1}
                            </span>
                          </Tooltip>
                        </>
                      )}
                    </Text>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div
          style={{
            padding: "18px 10px 0 10px",
            color: "#bfc9d1",
            fontSize: "15px",
            textAlign: "center",
          }}
        >
          Skill Tree view coming soon!
        </div>
      )}
    </Card>
  );
}
