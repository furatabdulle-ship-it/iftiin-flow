import { query } from './db';

export const communityInterestValues = ['future-skills', 'ai-literacy', 'media-literacy', 'storytelling'] as const;
export type CommunityInterest = (typeof communityInterestValues)[number];

export type CommunityProfile = {
  headline: string;
  bio: string;
  location: string;
  website: string;
  linkedinUrl: string;
  profilePictureUrl: string;
  personalLearningGoals: string;
  interests: CommunityInterest[];
  expertise: string[];
  isVisible: boolean;
  showDisplayName: boolean;
  showHeadline: boolean;
  showBio: boolean;
  showLocation: boolean;
  showWebsite: boolean;
  showLinkedIn: boolean;
  showProfilePicture: boolean;
  showInterests: boolean;
  showExpertise: boolean;
};

type CommunityProfileRow = {
  headline: string;
  bio: string;
  location: string;
  website: string;
  linkedinUrl: string;
  profilePictureUrl: string;
  personalLearningGoals: string;
  interests: CommunityInterest[];
  expertise: string[];
  isVisible: boolean;
  showDisplayName: boolean;
  showHeadline: boolean;
  showBio: boolean;
  showLocation: boolean;
  showWebsite: boolean;
  showLinkedIn: boolean;
  showProfilePicture: boolean;
  showInterests: boolean;
  showExpertise: boolean;
};

export const emptyCommunityProfile: CommunityProfile = {
  headline: '',
  bio: '',
  location: '',
  website: '',
  linkedinUrl: '',
  profilePictureUrl: '',
  personalLearningGoals: '',
  interests: [],
  expertise: [],
  isVisible: false,
  showDisplayName: false,
  showHeadline: false,
  showBio: false,
  showLocation: false,
  showWebsite: false,
  showLinkedIn: false,
  showProfilePicture: false,
  showInterests: false,
  showExpertise: false,
};

export async function getCommunityProfile(userId: string): Promise<CommunityProfile> {
  const result = await query<CommunityProfileRow>(
    `SELECT headline, bio, location, website,
            linkedin_url AS "linkedinUrl", profile_picture_url AS "profilePictureUrl",
            personal_learning_goals AS "personalLearningGoals", interests, expertise,
            is_visible AS "isVisible",
            show_display_name AS "showDisplayName", show_headline AS "showHeadline",
            show_bio AS "showBio", show_location AS "showLocation", show_website AS "showWebsite",
            show_linkedin AS "showLinkedIn", show_profile_picture AS "showProfilePicture",
            show_interests AS "showInterests", show_expertise AS "showExpertise"
     FROM community_profiles
     WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0] ?? { ...emptyCommunityProfile };
}

export async function saveCommunityProfile(userId: string, profile: CommunityProfile): Promise<CommunityProfile> {
  const result = await query<CommunityProfileRow>(
    `INSERT INTO community_profiles (
       user_id, headline, bio, location, website, linkedin_url, profile_picture_url,
       personal_learning_goals, interests, expertise, is_visible, show_display_name,
       show_headline, show_bio, show_location, show_website, show_linkedin,
       show_profile_picture, show_interests, show_expertise, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       headline = EXCLUDED.headline,
       bio = EXCLUDED.bio,
       location = EXCLUDED.location,
       website = EXCLUDED.website,
       linkedin_url = EXCLUDED.linkedin_url,
       profile_picture_url = EXCLUDED.profile_picture_url,
       personal_learning_goals = EXCLUDED.personal_learning_goals,
       interests = EXCLUDED.interests,
       expertise = EXCLUDED.expertise,
       is_visible = EXCLUDED.is_visible,
       show_display_name = EXCLUDED.show_display_name,
       show_headline = EXCLUDED.show_headline,
       show_bio = EXCLUDED.show_bio,
       show_location = EXCLUDED.show_location,
       show_website = EXCLUDED.show_website,
       show_linkedin = EXCLUDED.show_linkedin,
       show_profile_picture = EXCLUDED.show_profile_picture,
       show_interests = EXCLUDED.show_interests,
       show_expertise = EXCLUDED.show_expertise,
       updated_at = NOW()
     RETURNING headline, bio, location, website,
               linkedin_url AS "linkedinUrl", profile_picture_url AS "profilePictureUrl",
               personal_learning_goals AS "personalLearningGoals", interests, expertise,
               is_visible AS "isVisible",
               show_display_name AS "showDisplayName", show_headline AS "showHeadline",
               show_bio AS "showBio", show_location AS "showLocation", show_website AS "showWebsite",
               show_linkedin AS "showLinkedIn", show_profile_picture AS "showProfilePicture",
               show_interests AS "showInterests", show_expertise AS "showExpertise"`,
    [
      userId,
      profile.headline,
      profile.bio,
      profile.location,
      profile.website,
      profile.linkedinUrl,
      profile.profilePictureUrl,
      profile.personalLearningGoals,
      profile.interests,
      profile.expertise,
      profile.isVisible,
      profile.showDisplayName,
      profile.showHeadline,
      profile.showBio,
      profile.showLocation,
      profile.showWebsite,
      profile.showLinkedIn,
      profile.showProfilePicture,
      profile.showInterests,
      profile.showExpertise,
    ],
  );
  return result.rows[0];
}

export type CommunityMember = {
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  linkedinUrl: string | null;
  profilePictureUrl: string | null;
  interests: CommunityInterest[] | null;
  expertise: string[] | null;
};

export async function listCommunityMembers(filters: { search?: string; interest?: CommunityInterest | '' } = {}): Promise<CommunityMember[]> {
  const result = await query<CommunityMember>(
    `SELECT
       CASE WHEN profile.show_display_name THEN users.display_name END AS "displayName",
       CASE WHEN profile.show_headline THEN profile.headline END AS headline,
       CASE WHEN profile.show_bio THEN profile.bio END AS bio,
       CASE WHEN profile.show_location THEN profile.location END AS location,
       CASE WHEN profile.show_website THEN profile.website END AS website,
       CASE WHEN profile.show_linkedin THEN profile.linkedin_url END AS "linkedinUrl",
       CASE WHEN profile.show_profile_picture THEN profile.profile_picture_url END AS "profilePictureUrl",
       CASE WHEN profile.show_interests THEN profile.interests END AS interests,
       CASE WHEN profile.show_expertise THEN profile.expertise END AS expertise
     FROM community_profiles AS profile
     JOIN users ON users.id = profile.user_id
     WHERE profile.is_visible = TRUE
       AND (
         (profile.show_display_name AND users.display_name <> '')
         OR (profile.show_headline AND profile.headline <> '')
         OR (profile.show_bio AND profile.bio <> '')
         OR (profile.show_location AND profile.location <> '')
         OR (profile.show_website AND profile.website <> '')
         OR (profile.show_linkedin AND profile.linkedin_url <> '')
         OR (profile.show_profile_picture AND profile.profile_picture_url <> '')
         OR (profile.show_interests AND cardinality(profile.interests) > 0)
         OR (profile.show_expertise AND cardinality(profile.expertise) > 0)
       )
         AND (
           $1::text = ''
           OR concat_ws(' ',
             CASE WHEN profile.show_display_name THEN users.display_name END,
             CASE WHEN profile.show_headline THEN profile.headline END,
             CASE WHEN profile.show_bio THEN profile.bio END,
             CASE WHEN profile.show_location THEN profile.location END,
             CASE WHEN profile.show_website THEN profile.website END,
             CASE WHEN profile.show_linkedin THEN profile.linkedin_url END,
             CASE WHEN profile.show_interests THEN array_to_string(profile.interests, ' ') END,
             CASE WHEN profile.show_expertise THEN array_to_string(profile.expertise, ' ') END
           ) ILIKE '%' || $1 || '%'
         )
         AND (
           $2::text = ''
           OR (profile.show_interests AND $2 = ANY(profile.interests))
         )
     ORDER BY profile.updated_at DESC
     LIMIT 200`,
    [filters.search?.trim().slice(0, 80) ?? '', filters.interest ?? ''],
  );
  return result.rows;
}
