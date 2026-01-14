import React from "react";
import { Group, Container, Anchor } from "@mantine/core";
import classes from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={classes.footer} style={{ marginTop: "auto" }}>
      <Container size="responsive">
        <div className={classes.inner}>
          <div className={classes.footerContent}>
            <span>
              Inspired by{" "}
              <Anchor
                href="https://poe.ninja/"
                target="_blank"
                rel="noopener noreferrer"
              >
                poe.ninja
              </Anchor>
            </span>
            <Group gap="xl" justify="flex-end" h={40}>
              <Anchor href={"/privacy-policy"}>Privacy Policy</Anchor>
              <Anchor href={"/about"}>About</Anchor>
            </Group>
          </div>
        </div>
      </Container>
    </footer>
  );
}
