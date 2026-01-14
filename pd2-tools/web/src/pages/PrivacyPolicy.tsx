import { Card, Center, Stack, Text, Title, Anchor } from "@mantine/core";

export default function PrivacyPolicy() {
  return (
    <>
      <Center>
        <Card withBorder style={{ margin: "3%", maxWidth: "800px" }}>
          <Stack>
            <Title order={2}>Privacy Policy for pd2.tools</Title>
            <Text c="dimmed">Last Updated: June 18, 2025</Text>

            <Title order={3}>1. Introduction</Title>
            <Text>
              Welcome to pd2.tools ("we", "us", "our"). We are committed to
              protecting your privacy. This Privacy Policy explains how we
              collect, use, and share information when you use our website (the
              "Site").
              <br />
              <br />
              This policy is designed to be clear and transparent. If you have
              any questions, please contact us using the information provided
              below.
            </Text>

            <Title order={3}>2. Information We Collect and How We Use It</Title>
            <Title order={4}>Advertising</Title>
            <Text>
              CMI Marketing, Inc., d/b/a Raptive (“Raptive”) is a service
              provider of this Site for the purposes of placing advertising on
              the Site, and Raptive will collect and use certain data for
              advertising purposes. To learn more about Raptive’s data usage,
              click here:{" "}
              <Anchor
                href="https://raptive.com/creator-advertising-privacy-statement"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://raptive.com/creator-advertising-privacy-statement
              </Anchor>
              .
            </Text>
            <Text>
              In addition to advertising, we use the following services:
              <br />
              <br />
              <b>Google Analytics:</b> We use Google Analytics to understand how
              visitors engage with our Site. It collects standard internet log
              information (like your browser type and pages you visit) and
              details of visitor behavior patterns. This helps us improve our
              website and your experience. This data is processed in a way that
              does not directly identify anyone. For more information, please
              see the{" "}
              <Anchor
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics privacy policy
              </Anchor>
              .
              <br />
              <br />
              <b>Cookies:</b> Our Site uses cookies, which are small text files
              stored on your device, to enable the functionality of the services
              mentioned above. You can control or disable cookies through your
              web browser's settings, but please note that doing so may affect
              your ability to use certain features of our Site.
            </Text>

            <Title order={3}>3. Your Rights and Choices</Title>
            <Text>
              We respect your privacy rights and provide you with reasonable
              access to the personal data that you may have provided through
              your use of the Site. You have the following rights:
            </Text>
            <ul>
              <li>
                <Text>
                  <b>The Right to Know:</b> You have the right to request
                  information about the categories and specific pieces of
                  personal information we have collected about you.
                </Text>
              </li>
              <li>
                <Text>
                  <b>The Right to Delete:</b> You have the right to request the
                  deletion of your personal information that we have collected.
                </Text>
              </li>
              <li>
                <Text>
                  <b>The Right to Opt-Out of Sale:</b> Under laws like the
                  California Consumer Privacy Act (CCPA), the use of online
                  advertising services can be considered a "sale" of data. You
                  have the right to opt-out of this "sale" of your personal
                  information.
                </Text>
              </li>
            </ul>
            <Text>
              <b>How to Exercise Your Rights:</b>
              <br />
              To exercise these rights, please refer to the mechanisms provided
              in Raptive's advertising privacy statement linked above. To
              opt-out of Google Analytics tracking across all websites, you can
              install the{" "}
              <Anchor
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics Opt-out Browser Add-on
              </Anchor>
              .
            </Text>

            <Title order={3}>4. Changes to This Privacy Policy</Title>
            <Text>
              We may update this Privacy Policy from time to time to reflect
              changes in our practices or for other operational, legal, or
              regulatory reasons. We will post any changes on this page and
              update the "Last Updated" date at the top of this policy.
            </Text>

            <Title order={3}>5. Contact Us</Title>
            <Text>
              If you have any questions or concerns about this Privacy Policy or
              our data practices, please contact us at:
              <br />
              <b>admin@pd2.tools</b>
              <br />
              <br />
            </Text>
          </Stack>
        </Card>
      </Center>
    </>
  );
}
