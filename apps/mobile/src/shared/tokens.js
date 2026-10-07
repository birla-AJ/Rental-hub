// CozyHaven light system from the product design blueprint. Shared by React Native + Web.
export const tealFresh = {
  primary:'#4F7D61', primaryDark:'#315B43', primaryLight:'#8FB79C', secondary:'#6E9B79', accent:'#DDEBDD',
  background:'#F4F6F2', surface:'#FFFFFF', card:'#FFFFFF', softSurface:'#F8FAF7', textPrimary:'#17201A', textSecondary:'#56615A',
  border:'#DCE4DE', success:'#3F8B5D', warning:'#C98A35', error:'#C95B5B', info:'#4D83B8', ai:'#7A68A6', premium:'#C9A86A', premiumSoft:'#F3E9D4', disabled:'#87918A',
};
export const radius = { sm:12, md:16, lg:20, xl:24, pill:999 };
export const space = { 1:4, 2:8, 3:12, 4:16, 6:24, 8:32 };
export const shadow = { card:'0 8px 24px rgba(20,40,28,0.06)' };
export const statusColor = (t) => ({
  DRAFT:t.disabled, PENDING_VERIFICATION:t.warning, VERIFICATION_IN_PROGRESS:t.info, VERIFIED:t.success, REJECTED:t.error,
  OCCUPIED:t.primary, VACANT:t.warning, PLACEMENT_IN_PROGRESS:t.secondary, PLACED:t.success, INACTIVE:t.disabled,
});
export default tealFresh;
