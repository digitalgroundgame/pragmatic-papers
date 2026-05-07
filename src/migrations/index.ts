import * as migration_20250703_194534_init from "./20250703_194534_init"
import * as migration_20250705_042423_volume_update from "./20250705_042423_volume_update"
import * as migration_20250705_185916_add_media_access_control from "./20250705_185916_add_media_access_control"
import * as migration_20250705_213213_remove_unused_volume_relation from "./20250705_213213_remove_unused_volume_relation"
import * as migration_20250707_010714_remove_posts from "./20250707_010714_remove_posts"
import * as migration_20250708_020740_update_payload from "./20250708_020740_update_payload"
import * as migration_20250708_042411_update_media_image_sizes from "./20250708_042411_update_media_image_sizes"
import * as migration_20250708_212941_remove_medium_compat_size from "./20250708_212941_remove_medium_compat_size"
import * as migration_20250726_210541_implement_webhooks from "./20250726_210541_implement_webhooks"
import * as migration_20260109_081334_upgrade_payload_3_70_0 from "./20260109_081334_upgrade_payload_3_70_0"
import * as migration_20260110_021152_discord_header_button from "./20260110_021152_discord_header_button"
import * as migration_20260111_055750_slug_field_update from "./20260111_055750_slug_field_update"
import * as migration_20260117_020339_footnotes from "./20260117_020339_footnotes"
import * as migration_20260217_013724_header_footer_redesign from "./20260217_013724_header_footer_redesign"
import * as migration_20260303_233515_auto_generate_volume_title from "./20260303_233515_auto_generate_volume_title"
import * as migration_20260304_215356_feature_authors from "./20260304_215356_feature_authors"
import * as migration_20260305_050800_action_button_needed_more_migrations from "./20260305_050800_action_button_needed_more_migrations"
import * as migration_20260307_014204_enable_math_rendering from "./20260307_014204_enable_math_rendering"
import * as migration_20260307_192044_add_topics_to_articles from "./20260307_192044_add_topics_to_articles"
import * as migration_20260310_030303_update_volume_slugField from "./20260310_030303_update_volume_slugField"
import * as migration_20260311_160239_rename_Users_role_user_to_member from "./20260311_160239_rename_Users_role_user_to_member"
import * as migration_20260316_072557_add_blurdataurl from "./20260316_072557_add_blurdataurl"
import * as migration_20260317_033620_add_collections_again_thanks_esp from "./20260317_033620_add_collections_again_thanks_esp"
import * as migration_20260318_125059_revert_volume_autogen from "./20260318_125059_revert_volume_autogen"
import * as migration_20260318_152547_use_populate_authors_duh from "./20260318_152547_use_populate_authors_duh"
import * as migration_20260318_172936_topics_views from "./20260318_172936_topics_views"
import * as migration_20260321_165911_add_copyright_to_footer_global from "./20260321_165911_add_copyright_to_footer_global"
import * as migration_20260323_024225_add_showByline_to_admin from "./20260323_024225_add_showByline_to_admin"
import * as migration_20260323_043247_add_seo_to_topics from "./20260323_043247_add_seo_to_topics"
import * as migration_20260326_061304_add_social_links_component_to_footer from "./20260326_061304_add_social_links_component_to_footer"
import * as migration_20260326_115012_header_actions_array from "./20260326_115012_header_actions_array"
import * as migration_20260424_022531_add_timeline_block from "./20260424_022531_add_timeline_block"
import * as migration_20260430_004324_add_contributors_block from "./20260430_004324_add_contributors_block"
import * as migration_20260504_065125_add_narration_to_articles from "./20260504_065125_add_narration_to_articles"

export const migrations = [
  {
    up: migration_20250703_194534_init.up,
    down: migration_20250703_194534_init.down,
    name: "20250703_194534_init",
  },
  {
    up: migration_20250705_042423_volume_update.up,
    down: migration_20250705_042423_volume_update.down,
    name: "20250705_042423_volume_update",
  },
  {
    up: migration_20250705_185916_add_media_access_control.up,
    down: migration_20250705_185916_add_media_access_control.down,
    name: "20250705_185916_add_media_access_control",
  },
  {
    up: migration_20250705_213213_remove_unused_volume_relation.up,
    down: migration_20250705_213213_remove_unused_volume_relation.down,
    name: "20250705_213213_remove_unused_volume_relation",
  },
  {
    up: migration_20250707_010714_remove_posts.up,
    down: migration_20250707_010714_remove_posts.down,
    name: "20250707_010714_remove_posts",
  },
  {
    up: migration_20250708_020740_update_payload.up,
    down: migration_20250708_020740_update_payload.down,
    name: "20250708_020740_update_payload",
  },
  {
    up: migration_20250708_042411_update_media_image_sizes.up,
    down: migration_20250708_042411_update_media_image_sizes.down,
    name: "20250708_042411_update_media_image_sizes",
  },
  {
    up: migration_20250708_212941_remove_medium_compat_size.up,
    down: migration_20250708_212941_remove_medium_compat_size.down,
    name: "20250708_212941_remove_medium_compat_size",
  },
  {
    up: migration_20250726_210541_implement_webhooks.up,
    down: migration_20250726_210541_implement_webhooks.down,
    name: "20250726_210541_implement_webhooks",
  },
  {
    up: migration_20260109_081334_upgrade_payload_3_70_0.up,
    down: migration_20260109_081334_upgrade_payload_3_70_0.down,
    name: "20260109_081334_upgrade_payload_3_70_0",
  },
  {
    up: migration_20260110_021152_discord_header_button.up,
    down: migration_20260110_021152_discord_header_button.down,
    name: "20260110_021152_discord_header_button",
  },
  {
    up: migration_20260111_055750_slug_field_update.up,
    down: migration_20260111_055750_slug_field_update.down,
    name: "20260111_055750_slug_field_update",
  },
  {
    up: migration_20260117_020339_footnotes.up,
    down: migration_20260117_020339_footnotes.down,
    name: "20260117_020339_footnotes",
  },
  {
    up: migration_20260217_013724_header_footer_redesign.up,
    down: migration_20260217_013724_header_footer_redesign.down,
    name: "20260217_013724_header_footer_redesign",
  },
  {
    up: migration_20260303_233515_auto_generate_volume_title.up,
    down: migration_20260303_233515_auto_generate_volume_title.down,
    name: "20260303_233515_auto_generate_volume_title",
  },
  {
    up: migration_20260304_215356_feature_authors.up,
    down: migration_20260304_215356_feature_authors.down,
    name: "20260304_215356_feature_authors",
  },
  {
    up: migration_20260305_050800_action_button_needed_more_migrations.up,
    down: migration_20260305_050800_action_button_needed_more_migrations.down,
    name: "20260305_050800_action_button_needed_more_migrations",
  },
  {
    up: migration_20260307_014204_enable_math_rendering.up,
    down: migration_20260307_014204_enable_math_rendering.down,
    name: "20260307_014204_enable_math_rendering",
  },
  {
    up: migration_20260307_192044_add_topics_to_articles.up,
    down: migration_20260307_192044_add_topics_to_articles.down,
    name: "20260307_192044_add_topics_to_articles",
  },
  {
    up: migration_20260310_030303_update_volume_slugField.up,
    down: migration_20260310_030303_update_volume_slugField.down,
    name: "20260310_030303_update_volume_slugField",
  },
  {
    up: migration_20260311_160239_rename_Users_role_user_to_member.up,
    down: migration_20260311_160239_rename_Users_role_user_to_member.down,
    name: "20260311_160239_rename_Users_role_user_to_member",
  },
  {
    up: migration_20260316_072557_add_blurdataurl.up,
    down: migration_20260316_072557_add_blurdataurl.down,
    name: "20260316_072557_add_blurdataurl",
  },
  {
    up: migration_20260317_033620_add_collections_again_thanks_esp.up,
    down: migration_20260317_033620_add_collections_again_thanks_esp.down,
    name: "20260317_033620_add_collections_again_thanks_esp",
  },
  {
    up: migration_20260318_125059_revert_volume_autogen.up,
    down: migration_20260318_125059_revert_volume_autogen.down,
    name: "20260318_125059_revert_volume_autogen",
  },
  {
    up: migration_20260318_152547_use_populate_authors_duh.up,
    down: migration_20260318_152547_use_populate_authors_duh.down,
    name: "20260318_152547_use_populate_authors_duh",
  },
  {
    up: migration_20260318_172936_topics_views.up,
    down: migration_20260318_172936_topics_views.down,
    name: "20260318_172936_topics_views",
  },
  {
    up: migration_20260321_165911_add_copyright_to_footer_global.up,
    down: migration_20260321_165911_add_copyright_to_footer_global.down,
    name: "20260321_165911_add_copyright_to_footer_global",
  },
  {
    up: migration_20260323_024225_add_showByline_to_admin.up,
    down: migration_20260323_024225_add_showByline_to_admin.down,
    name: "20260323_024225_add_showByline_to_admin",
  },
  {
    up: migration_20260323_043247_add_seo_to_topics.up,
    down: migration_20260323_043247_add_seo_to_topics.down,
    name: "20260323_043247_add_seo_to_topics",
  },
  {
    up: migration_20260326_061304_add_social_links_component_to_footer.up,
    down: migration_20260326_061304_add_social_links_component_to_footer.down,
    name: "20260326_061304_add_social_links_component_to_footer",
  },
  {
    up: migration_20260326_115012_header_actions_array.up,
    down: migration_20260326_115012_header_actions_array.down,
    name: "20260326_115012_header_actions_array",
  },
  {
    up: migration_20260424_022531_add_timeline_block.up,
    down: migration_20260424_022531_add_timeline_block.down,
    name: "20260424_022531_add_timeline_block",
  },
  {
    up: migration_20260430_004324_add_contributors_block.up,
    down: migration_20260430_004324_add_contributors_block.down,
    name: "20260430_004324_add_contributors_block",
  },
  {
    up: migration_20260504_065125_add_narration_to_articles.up,
    down: migration_20260504_065125_add_narration_to_articles.down,
    name: "20260504_065125_add_narration_to_articles",
  },
]
