import { readSiteContent } from "../src/content/read-content";
import { ContentPage } from "../src/presentation/content-page";

export default function Home() {
  const content = readSiteContent();

  return (
    <ContentPage
      sections={content.home.sections}
      navigation={content.navigation}
      skipToContent={content.accessibility.skipToContent}
    />
  );
}
